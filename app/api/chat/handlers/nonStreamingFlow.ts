// --- Imports needed specifically for handleNonStreamingFlow ---
// import { PROMPT_LIST, PromptType } from "./prompts"; // OLD: Remove this
import { PROMPT_LIST as OPINION_PROMPTS } from "../prompts/opinionPrompts"; // Corrected path: Use renamed file
import { ADV_DISADV_TYPE1_PROMPTS } from "../prompts/adsType1Prompts"; // Corrected path: Use renamed file
import { DISCUSSION_PROMPT_LIST } from "../prompts/discussionPrompts"; // Corrected path: Use renamed file
import { PROMPT_LIST as CONCLUSION_PROMPT_LIST } from "../prompts/concPrompts"; // <-- Import Conclusion Prompts
import { PROMPT_LIST as OPINION_MBP_PROMPTS } from "../prompts/opinionMbpPrompts";

import { ConversationEntry, HandlerResult, ConversationProcessingInput, NamedMemory } from '../types/routeTypes'; // Go up one level, import NamedMemory
import {
  validateInput,
  generateRetryMessage,
  fetchApiResponseWithRetry,
  cleanLlmResponse
} from '../utils/openaiApiUtils'; // Go up one level
import {
  getModelForCurrentPrompt,
  RollbackOnValidationFailure
} from '../utils/promptUtils'; // Go up one level
import { handleAutoTransitionHidden, handleAutoTransitionVisible, processTransitions } from '../utils/autoTransitionUtils'; // Go up one level
import {
  injectNamedMemory,
  updateDynamicBufferMemory,
  saveUserInputToMemoryIfNeeded,
  processAssistantResponseMemory
  // NamedMemory is imported from types now
} from '../utils/memoryUtils'; // Go up one level
import { manageBuffer } from '../utils/bufferUtils'; // Go up one level
import { SessionCookieData } from '@/lib/session'; // This path remains the same
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
  const { messagesFromClient, sessionData, essayType } = input; // <-- Destructure essayType

  // Store the initial currentIndex intended for this turn
  const initialCurrentIndex = sessionData.currentIndex;
  console.log(`>>> [Fallback Debug] Start of Turn: initialCurrentIndex = ${initialCurrentIndex}`);

  // --- Select the correct prompt list based on essayType ---
  let activePromptList;
  switch (essayType) {
    case "ads_type1":
      activePromptList = ADV_DISADV_TYPE1_PROMPTS;
      console.log("[INFO] Using ADV_DISADV_TYPE1_PROMPTS");
      break;
    case "discussion":
      activePromptList = DISCUSSION_PROMPT_LIST;
      console.log("[INFO] Using DISCUSSION_PROMPT_LIST");
      break;
    case "opinion_conclusion": // <-- Add case for conclusion
      activePromptList = CONCLUSION_PROMPT_LIST;
      console.log("[INFO] Using CONCLUSION_PROMPT_LIST");
      break;
    case "opinion_mbp":
      activePromptList = OPINION_MBP_PROMPTS;
      console.log("[INFO] Using OPINION_MBP_PROMPTS");
      break;
    case "opinion":
    default: // Default to opinion if type is missing or unrecognized
      activePromptList = OPINION_PROMPTS;
      console.log("[INFO] Using OPINION_PROMPTS (Default)");
      break;
  }
  // Ensure activePromptList is assigned (should always be due to default)
  if (!activePromptList) {
    console.error(`[ERROR] Could not determine active prompt list for essayType: ${essayType}`);
    return { content: "Internal error: Invalid essay type configuration.", updatedSessionData: null };
  }
  // --- END Prompt List Selection ---


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
    if (promptIndexThatAskedLastQuestion !== null && promptIndexThatAskedLastQuestion !== undefined && promptIndexThatAskedLastQuestion >= 0 && promptIndexThatAskedLastQuestion < activePromptList.length) {
      const prevPromptObj = activePromptList[promptIndexThatAskedLastQuestion]; // Indexing is safe now due to checks above
      if (!prevPromptObj) {
        console.error(`[ERROR] Validation block: Could not find previous prompt object at index ${promptIndexThatAskedLastQuestion}`);
        return { content: "Internal error: Invalid session state.", updatedSessionData: null };
      }
      const prevPromptValidation = prevPromptObj.validation;
      const prevPromptValidationNeeded = typeof prevPromptValidation === 'boolean' ? prevPromptValidation : typeof prevPromptValidation === 'string';

      if (prevPromptValidationNeeded) {
         const customValidation = typeof prevPromptValidation === "string" ? prevPromptValidation : undefined;
         const prevPromptText = prevPromptObj.prompt_text || "";
         const prevPromptWithMemory = injectNamedMemory(prevPromptText, currentNamedMemory);
         console.log(`>>> [Fallback Debug] Validating user input "${userMessage}" against prompt index: ${promptIndexThatAskedLastQuestion}`);
         const isValid = await validateInput(userMessage, prevPromptWithMemory, customValidation);

         if (!isValid) {
           console.log(`>>> [Fallback Debug] Validation FAILED.`);
           isStorable = false; // Mark interaction as not storable

           console.log(`>>> [Fallback Debug] Initiating fallback logic...`);
           const failedPromptIndex = promptIndexThatAskedLastQuestion; // Store for clarity (still safe due to outer check)
           console.log(`>>> [Fallback Debug] Failed Prompt Index: ${failedPromptIndex}`);

           // CORRECTED Call: Pass activePromptList
           const targetIndexOnFallback = RollbackOnValidationFailure(failedPromptIndex, activePromptList);
           console.log(`>>> [Fallback Debug] RollbackOnValidationFailure(${failedPromptIndex}) determined targetIndexOnFallback: ${targetIndexOnFallback}`);

           // --- NEW DEBUG ---
           console.log(`>>> [Fallback Debug] PRE-CHECK: targetIndexOnFallback = ${targetIndexOnFallback}, failedPromptIndex = ${failedPromptIndex}`);
           console.log(`>>> [Fallback Debug] PRE-CHECK: Type of targetIndexOnFallback = ${typeof targetIndexOnFallback}, Type of failedPromptIndex = ${typeof failedPromptIndex}`);
           console.log(`>>> [Fallback Debug] PRE-CHECK: Condition (targetIndexOnFallback !== failedPromptIndex) evaluates to: ${(targetIndexOnFallback !== failedPromptIndex)}`);
           // --- END NEW DEBUG ---

           // Scenario 1: Fallback points to a DIFFERENT prompt index. Execute it fully.
           if (targetIndexOnFallback !== failedPromptIndex) {
                // --- NEW DEBUG ---
                console.log(`>>> [Fallback Debug] ENTERING 'if (targetIndexOnFallback !== failedPromptIndex)' BLOCK.`);
                // --- END NEW DEBUG ---
                console.log(`>>> [Fallback Debug] Fallback target (${targetIndexOnFallback}) is different from failed index (${failedPromptIndex}). Executing target prompt fully...`);

                // --- Execute the Target Fallback Prompt (e.g., index 1) ---
                const targetPromptObj = activePromptList[targetIndexOnFallback]; // <-- Use activePromptList
                if (!targetPromptObj) {
                    console.error(`[ERROR] Fallback block: Could not find prompt object at target index ${targetIndexOnFallback}`);
                    return { content: "Internal error: Could not execute fallback.", updatedSessionData: null };
                }

                // Simulate execution flow for the target prompt
                const fallbackPromptText = targetPromptObj.prompt_text || "";
                const fallbackPromptWithMemory = injectNamedMemory(fallbackPromptText, currentNamedMemory);
                currentBufferSize = updateDynamicBufferMemory(targetPromptObj, currentBufferSize); // Update buffer

                // Prepare history for the fallback call
                let historyPayloadForFallback = [
                    { role: "system", content: fallbackPromptWithMemory },
                    ...currentHistory.filter((entry) => entry.role !== "system"),
                ];
                historyPayloadForFallback = manageBuffer(historyPayloadForFallback, currentBufferSize);

                console.log(`>>> [Fallback Debug] Context for API call to target index ${targetIndexOnFallback}:`);
                console.log(JSON.stringify(historyPayloadForFallback, null, 2));

                console.log(`>>> [Fallback Debug] Making API call for target index ${targetIndexOnFallback}...`);
                const rawFallbackContent = await fetchApiResponseWithRetry({
                    model: getModelForCurrentPrompt(targetIndexOnFallback, activePromptList), // <-- Pass activePromptList
                    temperature: targetPromptObj?.temperature ?? 0,
                    messages: historyPayloadForFallback,
                });
                const fallbackContentCleaned = cleanLlmResponse(rawFallbackContent);

                if (!fallbackContentCleaned) {
                    console.error(`>>> [Fallback Debug] Fallback LLM call FAILED for target index ${targetIndexOnFallback}.`);
             return {
                        content: "I'm sorry, I couldn't process that fallback. Could you try again?",
               updatedSessionData: {
                            currentIndex: initialCurrentIndex,
                            promptIndexThatAskedLastQuestion: failedPromptIndex,
                 namedMemory: currentNamedMemory,
                 currentBufferSize: currentBufferSize
               }
             };
                } else {
                  console.log(`>>> [Fallback Debug] Fallback LLM call SUCCEEDED for target index ${targetIndexOnFallback}. Response: "${fallbackContentCleaned.substring(0,50)}..."`);
                }

                let baseFallbackResponse = fallbackContentCleaned;
                processAssistantResponseMemory(baseFallbackResponse, targetPromptObj, currentNamedMemory, targetIndexOnFallback);
                console.log(`>>> [Fallback Debug] Processed memory for target index ${targetIndexOnFallback}.`);

                const hasHiddenFlag = targetPromptObj.autoTransitionHidden === true;
                const hasVisibleFlag = targetPromptObj.autoTransitionVisible === true;

                if (hasHiddenFlag || hasVisibleFlag) {
                    let historyAfterFallbackLLM = [
                        ...historyPayloadForFallback,
                        { role: "assistant", content: baseFallbackResponse }
                    ];
                     if (targetPromptObj.important_memory) {
                         console.log(`>>> [Fallback Debug][Memory] Fallback prompt ${targetIndexOnFallback} is important_memory. Adding prefix to history context.`);
                         const lastMsgIndex = historyAfterFallbackLLM.length - 1;
                         historyAfterFallbackLLM[lastMsgIndex] = {
                             ...historyAfterFallbackLLM[lastMsgIndex],
                             content: `# ${baseFallbackResponse}`
                         };
                     }

                    console.log(`>>> [Fallback Debug] Fallback prompt ${targetIndexOnFallback} has autoTransition flag. Processing transitions...`);
                    const transitionResult = await processTransitions({
                        initialHistory: historyAfterFallbackLLM,
                        initialContent: baseFallbackResponse,
                        executedPromptIndex: targetIndexOnFallback,
                        initialNamedMemory: currentNamedMemory,
                        initialBufferSize: currentBufferSize,
                        activePromptList: activePromptList // <-- Pass activePromptList
                    });

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
                    console.log(`>>> [Fallback Debug] Fallback prompt ${targetIndexOnFallback} executed successfully but has NO autoTransition flag. Returning its content ONLY.`);
                     const finalSessionData = {
                         currentIndex: targetIndexOnFallback + 1,
                         promptIndexThatAskedLastQuestion: targetIndexOnFallback,
                         namedMemory: currentNamedMemory,
                         currentBufferSize: currentBufferSize
                     };
                    console.log(`>>> [Fallback Debug] Returning fallback content. Setting state for NEXT turn: ${JSON.stringify(finalSessionData)}`);
                    return {
                        content: baseFallbackResponse,
                        updatedSessionData: finalSessionData
                    };
                }

           } else {
               // Scenario 2: Fallback points to the SAME prompt index (or is invalid). Generate a retry message.
               // --- NEW DEBUG ---
               console.log(`>>> [Fallback Debug] ENTERING 'else' BLOCK (target index SAME as failed index).`);
               // --- END NEW DEBUG ---
               console.warn(`>>> [Fallback Debug] Fallback target (${targetIndexOnFallback}) is SAME as failed index (${failedPromptIndex}). Generating retry message.`);

               const failedPromptObj = activePromptList[failedPromptIndex]; // <-- Use activePromptList
               if (!failedPromptObj) {
                   console.error(`[ERROR] Fallback/Retry block: Could not find prompt object for failed index ${failedPromptIndex}`);
                   return { content: "Internal error: Could not generate retry message.", updatedSessionData: null };
               }

               const failedPromptText = failedPromptObj.prompt_text ?? "Please try that again.";
               const failedPromptWithMemory = injectNamedMemory(failedPromptText, currentNamedMemory);
               const historyForRetry = manageBuffer(currentHistory, currentBufferSize);
               const retryContent = await generateRetryMessage(userMessage, failedPromptWithMemory, historyForRetry);

               const finalSessionData = {
                   currentIndex: initialCurrentIndex,
                   promptIndexThatAskedLastQuestion: failedPromptIndex,
                 namedMemory: currentNamedMemory,
                   currentBufferSize: currentBufferSize
               };
                console.log(`>>> [Fallback Debug] Returning retry message for prompt ${failedPromptIndex}. Setting state for NEXT turn: ${JSON.stringify(finalSessionData)}`);
               return {
                   content: retryContent,
                   updatedSessionData: finalSessionData
               };
           }
           // --- End of fallback logic for if (!isValid) ---
         }
         // --- END OF CORRECTED LOGIC with extra DEBUG ---
         else {
           // --- Validation Succeeded for Previous Prompt ---
           console.log(`>>> [Fallback Debug] Validation SUCCEEDED for prompt index ${promptIndexThatAskedLastQuestion}. Proceeding with main flow.`);
           saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
         }
         // --- End of validation needed block ---
       } else {
         // --- No validation needed ---
         console.log(`[DEBUG] No validation needed for previous prompt index: ${promptIndexThatAskedLastQuestion}`);
         // Ensure prevPromptObj is fetched correctly even when validation isn't needed
         const prevPromptObj = (promptIndexThatAskedLastQuestion !== null && promptIndexThatAskedLastQuestion !== undefined && promptIndexThatAskedLastQuestion >= 0 && promptIndexThatAskedLastQuestion < activePromptList.length)
                             ? activePromptList[promptIndexThatAskedLastQuestion] // Indexing is safe now
                             : null;
         if (prevPromptObj) {
             saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
         } else {
             console.warn(`[DEBUG] Could not find prevPromptObj (index: ${promptIndexThatAskedLastQuestion}) when skipping validation. Memory saving for user input might be skipped.`);
         }
      }
      // --- End of previous prompt check ---
    } else {
         // console.log(`[DEBUG] No previous prompt index (${promptIndexThatAskedLastQuestion}) or it's out of bounds. Skipping validation.`);
    }
    // --- END of New Validation Block ---


    // --- Step 3: Check for Conversation Completion ---
    // If validation passed/skipped, check if we are already at the end
      if (currentIndex >= activePromptList.length) { // <-- Use activePromptList
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

    const currentPromptObj = activePromptList[currentIndex]; // <-- Use activePromptList
    if (!currentPromptObj) {
        // console.error("[ERROR] Current prompt object is missing at index:", currentIndex);
        return { content: "Internal error: Could not retrieve current prompt details.", updatedSessionData: null };
    }

    let assistantContentGenerated: string | null = null; // Use a distinct name for raw generated content
    let baseAssistantResponse: string; // Content after memory processing, etc.

    // --- Conditional Logic for Direct Output vs. LLM Call ---
    if (currentPromptObj.directOutput !== undefined && currentPromptObj.directOutput !== null) {
        // === Path for DIRECT OUTPUT prompts ===
        console.log(`[INFO][nonStreamingFlow] Executing DIRECT OUTPUT for prompt index: ${currentIndex}.`);
        assistantContentGenerated = currentPromptObj.directOutput;

        // No LLM call needed, so historyForLLM prep for an LLM is skipped *for this step*.
        // The overall conversation history (messagesFromClient) is still relevant.

    } else if (currentPromptObj.prompt_text) {
        // === Path for LLM-based prompts (existing logic) ===
        console.log(`[INFO][nonStreamingFlow] Executing LLM-based prompt for index: ${currentIndex}.`);
        const currentPromptTextWithMemory = injectNamedMemory(currentPromptObj.prompt_text, currentNamedMemory);

        currentBufferSize = updateDynamicBufferMemory(currentPromptObj, currentBufferSize); // Existing logic

        // Prepare history for the LLM call
        let historyForLLM = [
            { role: "system", content: currentPromptTextWithMemory },
            // currentHistory should be messagesFromClient here, representing the full chat up to the user's latest message
            ...messagesFromClient.filter((entry) => entry.role !== "system"),
        ];
        historyForLLM = manageBuffer(historyForLLM, currentBufferSize); // Existing logic

        const mainPayload = {
            model: getModelForCurrentPrompt(currentIndex, activePromptList), // Existing logic
            temperature: currentPromptObj?.temperature ?? 0, // Existing logic
            messages: historyForLLM,
        };

        console.log(`\n--- START API PAYLOAD (MAIN - Index: ${currentIndex}) ---`);
        console.log(JSON.stringify(mainPayload.messages.map(m => ({ role: m.role, content: (m.content ?? '').substring(0, 70) + '...' })), null, 2));
        console.log(`--- END API PAYLOAD (MAIN - Index: ${currentIndex}) ---\n`);

        const rawAssistantContentFromLLM = await fetchApiResponseWithRetry(mainPayload); // Existing logic
        assistantContentGenerated = cleanLlmResponse(rawAssistantContentFromLLM); // Existing logic

    } else {
        // === Path for Error or Misconfigured Prompt ===
        console.error(`[ERROR][nonStreamingFlow] Prompt index ${currentIndex} has neither directOutput nor prompt_text.`);
        assistantContentGenerated = "Error: Prompt configuration issue."; // Fallback error message
    }

    // --- Common processing AFTER content generation (direct or LLM) ---
    if (assistantContentGenerated === null) {
        console.error(`[ERROR][nonStreamingFlow] Failed to generate content for prompt index: ${currentIndex}.`);
        // Handle error: return a generic message, maintain current state for retry.
        return {
            content: "I'm sorry, I couldn't process that. Could you try again?",
            updatedSessionData: {
                currentIndex: currentIndex,
                promptIndexThatAskedLastQuestion: sessionData.promptIndexThatAskedLastQuestion, // From input sessionData
                namedMemory: currentNamedMemory,
                currentBufferSize: currentBufferSize
            }
        };
    }

    // Process memory (saveAssistantOutputAs) for the generated content
    baseAssistantResponse = processAssistantResponseMemory(
        assistantContentGenerated,
        currentPromptObj,
        currentNamedMemory, // This will be mutated by processAssistantResponseMemory
        currentIndex
    );

    // Prepare history context for subsequent operations (e.g., transitions)
    // This history MUST include the user's latest message AND this assistant's response.
    const historyIncludingThisTurn = [
        ...messagesFromClient, // Full history from client, ending with the latest user message
        { role: "assistant", content: baseAssistantResponse } // The response from this step (direct or LLM)
    ];

    // Handle appendTextAfterResponse
    let contentForTransitions = baseAssistantResponse;
    if (currentPromptObj.appendTextAfterResponse) {
        console.log(`[DEBUG][nonStreamingFlow] Appending static text for prompt index ${currentIndex}: "${currentPromptObj.appendTextAfterResponse}"`);
        contentForTransitions += "  \n" + currentPromptObj.appendTextAfterResponse;
    }

    const executedPromptIndex = currentIndex;

    // Call processTransitions
    // The history passed here (historyIncludingThisTurn) now correctly contains the direct output if it occurred.
    console.log(`[DEBUG][nonStreamingFlow] Calling processTransitions with historyIncludingThisTurn (length: ${historyIncludingThisTurn.length}) for executedPromptIndex: ${executedPromptIndex}`);
    const transitionResult = await processTransitions({
        initialHistory: historyIncludingThisTurn,
        initialContent: contentForTransitions,
        executedPromptIndex: executedPromptIndex,
        initialNamedMemory: currentNamedMemory, // currentNamedMemory is updated by processAssistantResponseMemory
        initialBufferSize: currentBufferSize,
        activePromptList: activePromptList
    });

    // Update state based on transition results
    let finalResponseContent = transitionResult.finalCombinedContent;
    let nextIndexAfterProcessing = transitionResult.nextIndexAfterProcessing;
    let indexGeneratingFinalResponse = transitionResult.indexGeneratingFinalResponse;
    currentNamedMemory = transitionResult.finalNamedMemory;
    currentBufferSize = transitionResult.finalBufferSize;

    // --- Step 6: Store to DB (Optional) and Prepare Final Return ---
    console.log(`>>> DEBUG: Reaching FINAL return. Final content generated by index: ${indexGeneratingFinalResponse}. Next turn index: ${nextIndexAfterProcessing}. isStorable: ${isStorable}`);

    // Store interaction result if needed
    const indexForStorageContext = isStorable ? promptIndexThatAskedLastQuestion : null; // Example: only store if valid
    if (isStorable && indexForStorageContext !== null && indexForStorageContext !== undefined && indexForStorageContext >= 0) {
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
    if (indexGeneratingFinalResponse >= 0 && indexGeneratingFinalResponse < activePromptList.length) { // <-- Use activePromptList
        const finalPromptObj = activePromptList[indexGeneratingFinalResponse]; // <-- Use activePromptList
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