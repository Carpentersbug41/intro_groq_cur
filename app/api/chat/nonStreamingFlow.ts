// --- Imports needed specifically for handleNonStreamingFlow ---
import { PROMPT_LIST, PromptType } from "./prompts";
import { ConversationEntry, HandlerResult, ConversationProcessingInput } from './routeTypes'; // Assuming types moved or defined here/imported
import {
  validateInput,
  generateRetryMessage,
  fetchApiResponseWithRetry,
  cleanLlmResponse
} from './openaiApiUtils';
import {
  getModelForCurrentPrompt,
  RollbackOnValidationFailure
} from './promptUtils';
import { handleAutoTransitionHidden, handleAutoTransitionVisible, processTransitions } from './autoTransitionUtils';
import {
  injectNamedMemory,
  updateDynamicBufferMemory,
  saveUserInputToMemoryIfNeeded,
  processAssistantResponseMemory,
  NamedMemory
} from './memoryUtils';
import { manageBuffer } from './bufferUtils';
import { SessionCookieData } from '@/lib/session'; // Import the type
// import { handleDatabaseStorageIfNeeded } from '@/utils/databaseHelpers'; // Keep commented if still unused

// --- insertImportantMemory (Helper used within handleNonStreamingFlow) ---
// Moved here as it's only used by handleNonStreamingFlow
function insertImportantMemory(conversationHistory: ConversationEntry[], content: string): ConversationEntry[] {
    const updatedHistory = [...conversationHistory]; // Work on a copy
    const systemIndex = updatedHistory.findIndex((msg) => msg.role === "system");
    let insertIndex = systemIndex !== -1 ? systemIndex + 1 : 0; // Insert after system or at start

    // Skip past any existing important memory lines right after system prompt
    while (
        insertIndex < updatedHistory.length &&
        updatedHistory[insertIndex].role === "assistant" &&
        updatedHistory[insertIndex].content.trim().startsWith("Important_memory:")
    ) {
        insertIndex++;
    }

    // Insert the new important memory
    updatedHistory.splice(insertIndex, 0, {
        role: "assistant", // Role should likely be assistant for memory
        content: `Important_memory: ${content}`
    });

    // console.log("[DEBUG] Important_memory helper inserted at index:", insertIndex);
    return updatedHistory; // Return the modified array
}


// --- Main Non-Streaming Flow Logic ---
export async function handleNonStreamingFlow(
  input: ConversationProcessingInput
): Promise<HandlerResult> {
  const { messagesFromClient, sessionData } = input;

  // Store the initial currentIndex intended for this turn
  const initialCurrentIndex = sessionData.currentIndex;
  console.log(`>>> [Fallback Debug] Start of Turn: initialCurrentIndex = ${initialCurrentIndex}`);

  // --- Step 1: Initialize Local State from Session ---
  let currentIndex = sessionData.currentIndex;
  const promptIndexThatAskedLastQuestion = sessionData.promptIndexThatAskedLastQuestion;
  let currentNamedMemory: NamedMemory = JSON.parse(JSON.stringify(sessionData.namedMemory ?? {}));
  let currentBufferSize = sessionData.currentBufferSize;

  if (typeof currentNamedMemory !== 'object' || currentNamedMemory === null || Array.isArray(currentNamedMemory)) {
      currentNamedMemory = {};
  }

  // --- Prepare History and Get User Message ---
  let currentHistory: ConversationEntry[] = [...messagesFromClient];
  const userMessageEntry = currentHistory[currentHistory.length - 1];
  if (!userMessageEntry || userMessageEntry.role !== 'user') {
      // console.error("[ERROR] handleNonStreamingFlow: Last message is not from user.");
      return { content: "Internal error: Invalid history state.", updatedSessionData: null };
  }
  const userMessage = userMessageEntry.content;
  // console.log("\n[INFO] Processing User Input:", userMessage.substring(0, 100) + "...");


  try {
    let isStorable = true; // Flag for DB storage, assume true unless validation fails

    // --- Step 2: VALIDATION BLOCK (New Location - Validate *Previous* Prompt's Question) ---
    // Check if there *was* a previous prompt that asked a question and if it requires validation.
    if (promptIndexThatAskedLastQuestion !== null && promptIndexThatAskedLastQuestion >= 0 && promptIndexThatAskedLastQuestion < PROMPT_LIST.length) {
      const prevPromptObj = PROMPT_LIST[promptIndexThatAskedLastQuestion];
      // Null check for prevPromptObj
      if (!prevPromptObj) {
        console.error(`[ERROR] Validation block: Could not find previous prompt object at index ${promptIndexThatAskedLastQuestion}`);
        // Handle error appropriately, maybe proceed without validation or return error
        return { content: "Internal error: Invalid session state.", updatedSessionData: null };
      }
      const prevPromptValidation = prevPromptObj.validation;
      const prevPromptValidationNeeded = typeof prevPromptValidation === 'boolean' ? prevPromptValidation : typeof prevPromptValidation === 'string';
       // console.log(`>>> [DEBUG][VALIDATION V2] Checking validation for PREVIOUS prompt index: ${promptIndexThatAskedLastQuestion}`);

      if (prevPromptValidationNeeded) {
         // console.log(`[INFO] Previous prompt (index ${promptIndexThatAskedLastQuestion}) requires validation for input: "${userMessage}"`);

         // Prepare previous prompt text with memory for validation context
         const prevPromptText = prevPromptObj.prompt_text || "";
         const prevPromptWithMemory = injectNamedMemory(prevPromptText, currentNamedMemory);

         const customValidation = typeof prevPromptValidation === "string" ? prevPromptValidation : undefined;
         console.log(`>>> [Fallback Debug] Validating user input "${userMessage}" against prompt index: ${promptIndexThatAskedLastQuestion}`);
         const isValid = await validateInput(userMessage, prevPromptWithMemory, customValidation);

         if (!isValid) {
           console.log(`>>> [Fallback Debug] Validation FAILED.`);
           isStorable = false; // Mark interaction as not storable due to failed validation

           // --- START: Reverted Fallback Calculation ---
           console.log(`>>> [Fallback Debug] Initiating fallback logic...`);
           console.log(`>>> [Fallback Debug] Failed Prompt Index (promptIndexThatAskedLastQuestion): ${promptIndexThatAskedLastQuestion}`);

           // Use the RollbackOnValidationFailure function again
           const targetIndexOnFallback = RollbackOnValidationFailure(promptIndexThatAskedLastQuestion);
           // The function already logs internally, but add context here
           console.log(`>>> [Fallback Debug] RollbackOnValidationFailure(${promptIndexThatAskedLastQuestion}) determined targetIndexOnFallback: ${targetIndexOnFallback}`);


           // Check if rollback actually changed the index (i.e., fallbackIndex was defined and > 0)
           if (targetIndexOnFallback !== promptIndexThatAskedLastQuestion) {
                console.log(`>>> [Fallback Debug] Fallback applied. Target index ${targetIndexOnFallback} is different from failed index ${promptIndexThatAskedLastQuestion}. Executing target prompt.`);

                // --- Execute the Target Fallback Prompt ---
                const targetPromptObj = PROMPT_LIST[targetIndexOnFallback];
                if (!targetPromptObj) {
                    console.error(`[ERROR] Fallback block: Could not find prompt object at target index ${targetIndexOnFallback}`);
                    return { content: "Internal error: Could not execute fallback.", updatedSessionData: null };
                }

                // Simulate execution flow for the target prompt
                const fallbackPromptText = targetPromptObj.prompt_text || "";
                const fallbackPromptWithMemory = injectNamedMemory(fallbackPromptText, currentNamedMemory);
                currentBufferSize = updateDynamicBufferMemory(targetPromptObj, currentBufferSize); // Update buffer for this prompt

                // Clean history? Decide if needed based on testing this new logic. Start without for simplicity.
                let historyPayloadForFallback = [
                    { role: "system", content: fallbackPromptWithMemory },
                    ...currentHistory.filter((entry) => entry.role !== "system"), // Use full current history for now
                ];
                historyPayloadForFallback = manageBuffer(historyPayloadForFallback, currentBufferSize);

                // Call LLM for the target fallback prompt
                const fallbackPayload = {
                    model: getModelForCurrentPrompt(targetIndexOnFallback),
                    temperature: targetPromptObj?.temperature ?? 0,
                    messages: historyPayloadForFallback,
                };

                // --- START EDIT: Log the context BEFORE the API call ---
                console.log(`>>> [Fallback Debug] Context for API call to target index ${targetIndexOnFallback}:`);
                console.log(JSON.stringify(historyPayloadForFallback, null, 2)); // Log the full messages array
                console.log(`--- End Fallback API Call Context ---`);
                // --- END EDIT ---

                console.log(`>>> [Fallback Debug] Making API call for target index ${targetIndexOnFallback}...`);
                const rawFallbackContent = await fetchApiResponseWithRetry(fallbackPayload);
                const fallbackContentCleaned = cleanLlmResponse(rawFallbackContent);

                if (!fallbackContentCleaned) {
                    console.error(`>>> [Fallback Debug] Fallback LLM call FAILED for target index ${targetIndexOnFallback}.`);
                    // Return state as it was *before* this failed attempt, but advance index to avoid loop
             return {
                        content: "I'm sorry, I couldn't process that fallback. Could you try again?",
               updatedSessionData: {
                            currentIndex: currentIndex, // Keep original intended next index
                            promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion, // The one that failed validation
                 namedMemory: currentNamedMemory,
                 currentBufferSize: currentBufferSize
               }
             };
                } else {
                  console.log(`>>> [Fallback Debug] Fallback LLM call SUCCEEDED for target index ${targetIndexOnFallback}. Response: "${fallbackContentCleaned.substring(0,50)}..."`);
                }

                // Process memory for the fallback response
                let baseFallbackResponse = fallbackContentCleaned ?? "[Fallback Error]"; // Handle null case
                processAssistantResponseMemory(baseFallbackResponse, targetPromptObj, currentNamedMemory, targetIndexOnFallback);
                console.log(`>>> [Fallback Debug] Processed memory for target index ${targetIndexOnFallback}.`);

                // --- START EDIT: Check for Transitions on Fallback Prompt ---
                const hasHiddenFlag = targetPromptObj.autoTransitionHidden === true;
                const hasVisibleFlag = targetPromptObj.autoTransitionVisible === true;

                if (hasHiddenFlag || hasVisibleFlag) {
                    // Prepare history *including* the fallback response for transitions
                    let historyAfterFallbackLLM = [
                        ...historyPayloadForFallback, // History used FOR the call
                        // Add the assistant response received from the fallback call
                        // IMPORTANT: Use the *clean* response before potential prefixing
                        { role: "assistant", content: baseFallbackResponse }
                    ];
                    // Handle important memory prefixing for the history context if needed
                    // Note: processTransitions expects the clean content as initialContent,
                    // but the history context might need the prefix.
                     if (targetPromptObj.important_memory) {
                         console.log(`>>> [Fallback Debug][Memory] Fallback prompt ${targetIndexOnFallback} is important_memory. Adding prefix to history context.`);
                         // Apply prefix to the last message in history for transition context
                         historyAfterFallbackLLM[historyAfterFallbackLLM.length - 1].content = `Important_memory: ${baseFallbackResponse}`;
                         // baseFallbackResponse itself remains clean for processTransitions initialContent
                     }

                    console.log(`>>> [Fallback Debug] Fallback prompt ${targetIndexOnFallback} has autoTransition flag. Processing transitions...`);
                    const transitionResult = await processTransitions({
                        initialHistory: historyAfterFallbackLLM, // History context *after* fallback call
                        initialContent: baseFallbackResponse, // Clean content *from* fallback call
                        executedPromptIndex: targetIndexOnFallback, // The index that "executed"
                        initialNamedMemory: currentNamedMemory, // Memory *after* fallback processing
                        initialBufferSize: currentBufferSize, // Buffer size *after* fallback update
                    });

                    // Return result from transitions
                    console.log(`>>> [Fallback Debug] Fallback + Transition complete. Final content generated by index: ${transitionResult.indexGeneratingFinalResponse}. Next turn index: ${transitionResult.nextIndexAfterProcessing}.`);
                     const finalSessionData = {
                         currentIndex: transitionResult.nextIndexAfterProcessing,
                         promptIndexThatAskedLastQuestion: transitionResult.indexGeneratingFinalResponse,
                         namedMemory: transitionResult.finalNamedMemory,
                         currentBufferSize: transitionResult.finalBufferSize
                     };
                    console.log(`>>> [Fallback Debug] Returning transition result. Setting state for NEXT turn: ${JSON.stringify(finalSessionData)}`);
                    return {
                        content: transitionResult.finalCombinedContent,
                        updatedSessionData: finalSessionData
                    };

                } else {
                    // --- No Transition on Fallback Prompt ---
                    console.log(`>>> [Fallback Debug] Fallback prompt ${targetIndexOnFallback} has NO autoTransition flag. Returning its content ONLY.`);
                    // Return the fallback content and set state for the next turn (current behavior)
                     const finalSessionData = {
                         currentIndex: targetIndexOnFallback + 1,
                         promptIndexThatAskedLastQuestion: targetIndexOnFallback,
                         namedMemory: currentNamedMemory,
                         currentBufferSize: currentBufferSize
                     };
                    console.log(`>>> [Fallback Debug] Returning fallback content. Setting state for NEXT turn: ${JSON.stringify(finalSessionData)}`);
                    return {
                        content: baseFallbackResponse, // Return the clean response
                        updatedSessionData: finalSessionData
                    };
                }
                // --- END EDIT: Check for Transitions on Fallback Prompt ---

           } else {
               // --- Fallback Calculation Resulted in NO Index Change ---
               // (This happens if fallbackIndex was 0 or undefined on the failed prompt)
               console.warn(`>>> [Fallback Debug] Fallback calculation resulted in NO index change (target index ${targetIndexOnFallback} is same as failed index ${promptIndexThatAskedLastQuestion}). Re-asking original question.`);
               // Revert to re-asking the prompt that failed validation
               const failedPromptObj = prevPromptObj;
               const failedPromptText = failedPromptObj.prompt_text ?? "Please try that again.";
               const failedPromptWithMemory = injectNamedMemory(failedPromptText, currentNamedMemory);

               // --- START EDIT: Apply buffer to history before generating retry message ---
               // Use the currentHistory which includes the user's invalid message
               // Use the currentBufferSize active at this point (before potential fallback prompt updates)
               const historyForRetry = manageBuffer(currentHistory, currentBufferSize);
               console.log(`[DEBUG] Applying buffer size ${currentBufferSize} to history before generating retry message.`);
               // --- END EDIT ---

               // --- Pass the *buffered* history to generateRetryMessage ---
               const retryContent = await generateRetryMessage(userMessage, failedPromptWithMemory, historyForRetry); // Use historyForRetry

               const finalSessionData = {
                   currentIndex: initialCurrentIndex, // Keep original intended index
                   promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion,
                 namedMemory: currentNamedMemory,
                 currentBufferSize: currentBufferSize // Use the buffer size active before the fallback attempt
               };
                console.log(`>>> [Fallback Debug] Returning retry message for prompt ${promptIndexThatAskedLastQuestion}. Setting state for NEXT turn: ${JSON.stringify(finalSessionData)}`);
               return {
                   content: retryContent,
                   updatedSessionData: finalSessionData
               };
           }
           // --- END: Reverted Fallback Calculation ---

         } else {
           // --- Validation Succeeded for Previous Prompt ---
           console.log(`>>> [Fallback Debug] Validation SUCCEEDED for prompt index ${promptIndexThatAskedLastQuestion}. Proceeding with main flow.`);
           // Proceed normally to generate the response for the *current* `currentIndex`.
           // Save user input to memory NOW based on the prompt that asked the question
           saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory); // Use prevPromptObj checked earlier
           // console.log(`>>> [DEBUG][MEMORY] Saved user input based on previous prompt ${promptIndexThatAskedLastQuestion}. Memory: ${JSON.stringify(currentNamedMemory)}`);
         }
       } else {
         // console.log(`[DEBUG] No validation needed for previous prompt index: ${promptIndexThatAskedLastQuestion}`);
         // Previous prompt didn't require validation, save user input based on it if configured
         saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory); // Use prevPromptObj checked earlier
         // console.log(`>>> [DEBUG][MEMORY] Saved user input based on previous prompt ${promptIndexThatAskedLastQuestion} (no validation needed). Memory: ${JSON.stringify(currentNamedMemory)}`);
       }
    } else {
         // console.log(`[DEBUG] No previous prompt index (${promptIndexThatAskedLastQuestion}) or it's out of bounds. Skipping validation.`);
         // This happens on the very first turn or if session state is weird.
         // Optionally save input based on current index if needed? For now, do nothing extra.
    }
    // --- END of New Validation Block ---


    // --- Step 3: Check for Conversation Completion ---
    // If validation passed/skipped, check if we are already at the end
      if (currentIndex >= PROMPT_LIST.length) {
       // console.log("[INFO] Conversation Complete (currentIndex out of bounds).");
           return {
               content: "Thank you for your responses! Goodbye.",
         // Save state reflecting completion
         updatedSessionData: { currentIndex, promptIndexThatAskedLastQuestion: currentIndex-1, namedMemory: currentNamedMemory, currentBufferSize }
           };
      }

    // --- Step 4: Main Flow - Generate Response for CURRENT Index ---
    // If we reach here, validation succeeded or wasn't needed for the previous prompt.
    // We now generate the response for the prompt at `currentIndex`.

      const currentPromptObj = PROMPT_LIST[currentIndex];
    if (!currentPromptObj) {
         // console.error("[ERROR] Current prompt object is missing at index:", currentIndex);
         return { content: "Internal error: Could not retrieve current prompt details.", updatedSessionData: null };
    }
    const currentPromptText = currentPromptObj.prompt_text || "";
      const currentPromptWithMemory = injectNamedMemory(currentPromptText, currentNamedMemory);

    // Update dynamic buffer size based on the prompt that is *about to run*
    currentBufferSize = updateDynamicBufferMemory(currentPromptObj, currentBufferSize);

    // Prepare conversation history for the main LLM call
    let historyForLLM = [
          { role: "system", content: currentPromptWithMemory },
          ...currentHistory.filter((entry) => entry.role !== "system"),
      ];
    historyForLLM = manageBuffer(historyForLLM, currentBufferSize);

    // --- PAYLOAD PREP DEBUG LOG (Existing) ---
    console.log(`>>> [PAYLOAD PREP DEBUG] History BEING USED for payload (Index: ${currentIndex}, Size: ${historyForLLM.length}):`);
    console.log(JSON.stringify(historyForLLM.map(m => ({ role: m.role, content: (m.content ?? '').substring(0, 70) + '...' })), null, 2));
    // --- END PAYLOAD PREP DEBUG LOG ---

      // --- Main LLM Call ---
      const mainPayload = {
      model: getModelForCurrentPrompt(currentIndex),
      temperature: currentPromptObj?.temperature ?? 0,
      messages: historyForLLM, // Assigning the buffered history
      };

    // --- START NEW DEBUG LOG ---
    console.log(">>> [POST-ASSIGN DEBUG] Content of mainPayload.messages IMMEDIATELY after assignment:");
    console.log(JSON.stringify(mainPayload.messages.map(m => ({ role: m.role, content: (m.content ?? '').substring(0, 70) + '...' })), null, 2));
    // --- END NEW DEBUG LOG ---

      // --- START API PAYLOAD LOG (MODIFIED) ---
      console.log(`\n--- START API PAYLOAD (MAIN - Index: ${currentIndex}) ---`);
      // console.log(JSON.stringify(mainPayload.messages, null, 2)); // <<< Comment out the stringify version
      console.log("Simple log of mainPayload.messages structure:", mainPayload.messages); // <<< Log the raw object/array
      console.log(`--- END API PAYLOAD (MAIN - Index: ${currentIndex}) ---\n`);
      // --- END START API PAYLOAD LOG ---

      const rawAssistantContent = await fetchApiResponseWithRetry(mainPayload);
    const assistantContentCleaned = cleanLlmResponse(rawAssistantContent);

      if (!assistantContentCleaned) {
       // console.error("[ERROR] Main LLM call failed for index:", currentIndex);
       // Return state as it was *before* this failed call attempt
          return {
         content: "I'm sorry, I couldn't process that. Could you repeat?",
         updatedSessionData: {
            currentIndex: currentIndex, // Stay on the current index
            promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion, // The last *successful* question asker
            namedMemory: currentNamedMemory,
            currentBufferSize: currentBufferSize
          }
          };
      }

      // --- Process Assistant Response Memory (Save & Prefix) ---
    // Uses config for the prompt that just ran (currentPromptObj at currentIndex)
    let baseAssistantResponse = processAssistantResponseMemory(
          assistantContentCleaned,
      currentPromptObj,
          currentNamedMemory,
      currentIndex
      );

    // --- History Context *After* Main LLM Call (for transitions) ---
      let historyAfterLLM = [
      ...historyForLLM, // Use the history that was *actually sent* to the API
      { role: "assistant", content: baseAssistantResponse } // Use base response here
      ];

    // --- New Step: Append Static Text if Configured ---
    let contentForTransitions = baseAssistantResponse; // Start with the processed response
    if (currentPromptObj.appendTextAfterResponse) {
      console.log(`[DEBUG] Appending static text for prompt index ${currentIndex}: "${currentPromptObj.appendTextAfterResponse}"`);
      // Add two spaces and a newline before the appended text for Markdown hard break
      contentForTransitions += "  \n" + currentPromptObj.appendTextAfterResponse;
    }
    // --- End New Step ---

    // --- Step 5: Process Transitions ---
    const executedPromptIndex = currentIndex; // The index that just generated the main response

    // Call the refactored transition processing function
    const transitionResult = await processTransitions({
        initialHistory: historyAfterLLM,
        initialContent: contentForTransitions, // Pass content with appended text
        executedPromptIndex: executedPromptIndex,
        initialNamedMemory: currentNamedMemory, // Pass memory *after* main call processing
        initialBufferSize: currentBufferSize, // Pass buffer size *after* main call update
    });

    // Update state based on transition results
    let finalResponseContent = transitionResult.finalCombinedContent;
    let nextIndexAfterProcessing = transitionResult.nextIndexAfterProcessing;
    let indexGeneratingFinalResponse = transitionResult.indexGeneratingFinalResponse;
    currentNamedMemory = transitionResult.finalNamedMemory;
    currentBufferSize = transitionResult.finalBufferSize;

    // --- Step 6: Store to DB (Optional) and Prepare Final Return ---
     console.log(`>>> DEBUG: Reaching FINAL return. Final content generated by index: ${indexGeneratingFinalResponse}. Next turn index: ${nextIndexAfterProcessing}. isStorable: ${isStorable}`);

     // Store interaction result if needed (using the index that *asked* the question for context, if validation passed)
     // If validation failed (isStorable=false), maybe don't store? Or store failure? Needs decision.
     const indexForStorageContext = isStorable ? promptIndexThatAskedLastQuestion : null; // Example: only store if valid
     if (isStorable && indexForStorageContext !== null && indexForStorageContext >= 0) {
       const contentToStore = finalResponseContent ?? "";
       // await handleDatabaseStorageIfNeeded(indexForStorageContext, contentToStore, userMessage); // Pass user message too
       // console.log(`[DB-DEBUG] Storing final content related to prompt index ${indexForStorageContext} question.`);
      } else {
       // console.log("[DB-DEBUG] Interaction was not stored (isStorable=false or no valid prev index).");
      }

     // --- START EDIT: Modify Final Context Logging ---
     console.log("--------------------------------------------------");
     console.log("[DEBUG] FINAL CONTEXT before returning from handleNonStreamingFlow:");

     // 1. Log the System Prompt used for the final generating step
     let finalSystemPromptText = "[Error: Could not determine final system prompt]";
     if (indexGeneratingFinalResponse >= 0 && indexGeneratingFinalResponse < PROMPT_LIST.length) {
         const finalPromptObj = PROMPT_LIST[indexGeneratingFinalResponse];
         if (finalPromptObj) {
             const rawPrompt = finalPromptObj.prompt_text || "[Prompt text missing]";
             finalSystemPromptText = injectNamedMemory(rawPrompt, currentNamedMemory);
         }
     }
     console.log("  - System Prompt (for generating index " + indexGeneratingFinalResponse + "):");
     console.log("    " + finalSystemPromptText.replace(/\n/g, "\n    "));

     // 2. REMOVED: Log the history RECEIVED from the client this turn
     // console.log("  - History Received from Client this Turn:", JSON.stringify(messagesFromClient, null, 2)); // <-- Commented out

     // 3. Log the final content being sent back
     console.log("  - Final Assistant Content Sent to Client:", finalResponseContent ? `"${finalResponseContent}"` : "[null]");

     // 4. Log Session Data to be Saved (No change)
     console.log("  - Session Data to be Saved for NEXT Turn:", JSON.stringify({
         currentIndex: nextIndexAfterProcessing,
         promptIndexThatAskedLastQuestion: indexGeneratingFinalResponse,
         namedMemory: currentNamedMemory,
         currentBufferSize: currentBufferSize
     }, null, 2));
     console.log("--------------------------------------------------");
     // --- END EDIT: Modify Final Context Logging ---


     // Return final content and session state for the *next* turn
      return {
       content: finalResponseContent,
          updatedSessionData: {
         currentIndex: nextIndexAfterProcessing, // Index for the *next* prompt
         promptIndexThatAskedLastQuestion: indexGeneratingFinalResponse, // Index that generated *this* response
              namedMemory: currentNamedMemory,
              currentBufferSize: currentBufferSize
          }
      };

  } catch (error: any) {
      console.error("[JEST_DEBUG] ERROR CAUGHT in handleNonStreamingFlow:", error);
      return { content: "An internal server error occurred during processing.", updatedSessionData: null }; // Avoid saving state on error
  } finally {
      // console.log("Exiting handleNonStreamingFlow.");
  }
} // End of handleNonStreamingFlow export 