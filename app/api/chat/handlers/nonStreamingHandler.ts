// --- Imports ---
// Import necessary types, constants, and utilities used within handleNonStreamingFlow
import PROMPT_LIST from "../prompts";
import { cookies } from 'next/headers'; // Keep if needed for session/DB within handler? Check usage.
import { handleDatabaseStorageIfNeeded } from "@/utils/databaseHelpers";
import {
  validateInput,
  generateRetryMessage,
  fetchApiResponseWithRetry,
  cleanLlmResponse
} from '../openaiApiUtils';
import {
  getModelForCurrentPrompt,
  RollbackOnValidationFailure
} from '../promptUtils';
import {
  handleAutoTransitionHidden,
  handleAutoTransitionVisible
} from '../autoTransitionUtils';
import { chainIfNeeded } from '../chainUtils';
import {
  injectNamedMemory,
  updateDynamicBufferMemory,
  saveUserInputToMemoryIfNeeded,
  processAssistantResponseMemory,
  NamedMemory
} from '../memoryUtils';
import { manageBuffer } from '../bufferUtils';
import { SessionCookieData } from '@/lib/session'; // Import the type definition

// --- Interfaces (Moved from route.ts) ---
type ConversationEntry = { role: string; content: string };

// Input required by the handler
export interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData;
}

// Output returned by the handler
export interface HandlerResult {
  content: string | null;
  updatedSessionData: Partial<SessionCookieData> | null;
}


// --- Main Non-Streaming Handler Function (Moved from route.ts) ---
export async function handleNonStreamingFlow(
  input: ConversationProcessingInput
): Promise<HandlerResult> {
  const { messagesFromClient, sessionData } = input;

  // console.log("Entering handleNonStreamingFlow with session data:", JSON.stringify(sessionData, null, 2));

  // --- Step 1: Initialize Local State from Session ---
  let currentIndex = sessionData.currentIndex; // Index for the NEXT prompt to generate
  const promptIndexThatAskedLastQuestion = sessionData.promptIndexThatAskedLastQuestion; // Index of the prompt the user is responding TO
  let currentNamedMemory: NamedMemory = JSON.parse(JSON.stringify(sessionData.namedMemory ?? {}));
  let currentBufferSize = sessionData.currentBufferSize;

  if (typeof currentNamedMemory !== 'object' || currentNamedMemory === null || Array.isArray(currentNamedMemory)) {
      currentNamedMemory = {};
  }
  // console.log(`>>> [DEBUG][FLOW_V2] Initial State: currentIndex=${currentIndex}, askedBy=${promptIndexThatAskedLastQuestion}`);


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
      const prevPromptValidation = prevPromptObj?.validation;
      const prevPromptValidationNeeded = typeof prevPromptValidation === 'boolean' ? prevPromptValidation : typeof prevPromptValidation === 'string';
       // console.log(`>>> [DEBUG][VALIDATION V2] Checking validation for PREVIOUS prompt index: ${promptIndexThatAskedLastQuestion}`);

      if (prevPromptValidationNeeded) {
         // console.log(`[INFO] Previous prompt (index ${promptIndexThatAskedLastQuestion}) requires validation for input: "${userMessage}"`);

         // Prepare previous prompt text with memory for validation context
         const prevPromptText = prevPromptObj?.prompt_text || "";
         const prevPromptWithMemory = injectNamedMemory(prevPromptText, currentNamedMemory);

         const customValidation = typeof prevPromptValidation === "string" ? prevPromptValidation : undefined;
         const isValid = await validateInput(userMessage, prevPromptWithMemory, customValidation);

         if (!isValid) {
           console.log(`>>> DEBUG: Validation FAILED for user input "${userMessage}" against rules of prompt index: ${promptIndexThatAskedLastQuestion}`);
           isStorable = false; // Mark interaction as not storable due to failed validation

           // --- Apply Rollback based on the prompt that FAILED validation ---
           const rolledBackIndex = RollbackOnValidationFailure(promptIndexThatAskedLastQuestion); // Rollback based on the prompt that asked
           console.log(`>>> DEBUG: RollbackOnValidationFailure(${promptIndexThatAskedLastQuestion}) returned: ${rolledBackIndex}`);

           if (rolledBackIndex !== promptIndexThatAskedLastQuestion) {
             console.log(`>>> DEBUG: Applying rollback. Failing index: ${promptIndexThatAskedLastQuestion}, Rolled-back index: ${rolledBackIndex}`);

             // --- Generate Retry Message & Return IMMEDIATELY---
             const rolledBackPromptObj = PROMPT_LIST[rolledBackIndex];
             const rolledBackPromptText = rolledBackPromptObj?.prompt_text ?? "Please try again.";
             const rolledBackPromptWithMemory = injectNamedMemory(rolledBackPromptText, currentNamedMemory);
             const retryContent = await generateRetryMessage(userMessage, rolledBackPromptWithMemory, messagesFromClient); // Pass history
             // console.log(`>>> DEBUG: About to execute IMMEDIATE return for rolled-back index: ${rolledBackIndex}`);
             console.log(`>>> DEBUG: About to execute IMMEDIATE return. Retry based on index ${rolledBackIndex}. Next turn starts at index ${rolledBackIndex + 1}.`);


             // Return immediately with the retry message.
             // The *next* turn will start at the index AFTER the rolled-back index.
             // The question implicitly "asked" by the retry message corresponds to the rolled-back index.
             return {
               content: retryContent,
               updatedSessionData: {
                 currentIndex: rolledBackIndex + 1, // Next turn starts *after* the rolled-back index
                 promptIndexThatAskedLastQuestion: rolledBackIndex, // The retry message "asks" based on this index
                 namedMemory: currentNamedMemory,
                 currentBufferSize: currentBufferSize
               }
             };
             // --- End of Immediate Return for Rollback ---

           } else { // Validation failed BUT no rollback occurred (fallbackIndex was 0 or undefined for the prompt that asked)
             console.log(`>>> DEBUG: Validation failed for prompt ${promptIndexThatAskedLastQuestion}, but no rollback applied (fallbackIndex=0 or undefined).`);
             // What should happen here? Re-ask the SAME question from promptIndexThatAskedLastQuestion?
             // Let's generate a standard retry based on the *failed* prompt index for now.
             const failedPromptText = prevPromptObj?.prompt_text ?? "Please try that again.";
             const failedPromptWithMemory = injectNamedMemory(failedPromptText, currentNamedMemory);
             const retryContent = await generateRetryMessage(userMessage, failedPromptWithMemory, messagesFromClient);

             console.log(`>>> DEBUG: About to execute IMMEDIATE return to re-ask prompt: ${promptIndexThatAskedLastQuestion}`);
             return {
               content: retryContent, // Re-ask the same question
               updatedSessionData: {
                 currentIndex: currentIndex, // Next turn still *intended* to be the one after the failed prompt
                 promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion, // We are re-asking this question
                 namedMemory: currentNamedMemory,
                 currentBufferSize: currentBufferSize
               }
             };
           }
         } else {
           // --- Validation Succeeded for Previous Prompt ---
           console.log(`[INFO] Validation SUCCEEDED for user input "${userMessage}" against prompt index: ${promptIndexThatAskedLastQuestion}`);
           // Proceed normally to generate the response for the *current* `currentIndex`.
           // Save user input to memory NOW based on the prompt that asked the question
           saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
           // console.log(`>>> [DEBUG][MEMORY] Saved user input based on previous prompt ${promptIndexThatAskedLastQuestion}. Memory: ${JSON.stringify(currentNamedMemory)}`);
         }
       } else {
         // console.log(`[DEBUG] No validation needed for previous prompt index: ${promptIndexThatAskedLastQuestion}`);
         // Previous prompt didn't require validation, save user input based on it if configured
         saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
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

      console.log(`Attempting to access PROMPT_LIST at index: ${currentIndex}`);
      try {
      const currentPromptObj = PROMPT_LIST[currentIndex];
         console.log('Successfully accessed prompt:', currentPromptObj);
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

      // --- Main LLM Call ---
      const mainPayload = {
           model: getModelForCurrentPrompt(currentIndex),
           temperature: currentPromptObj?.temperature ?? 0,
           messages: historyForLLM,
      };
      // console.log("[DEBUG] Main Payload to LLM (index", currentIndex, "):", JSON.stringify(mainPayload, null, 2));
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
         let initialResponseContent = processAssistantResponseMemory(
          assistantContentCleaned,
           currentPromptObj,
          currentNamedMemory,
           currentIndex
      );

         // --- History Context *After* Main LLM Call (for transitions) ---
      let historyAfterLLM = [
           ...historyForLLM,
           { role: "assistant", content: initialResponseContent }
      ];
         if (currentPromptObj.important_memory) {
          historyAfterLLM = insertImportantMemory(historyAfterLLM, initialResponseContent);
      }

      // --- Step 5: Process Transitions using the new helper ---
      const executedPromptIndex = currentIndex; // The index that just generated the main response

      const transitionResult = await processTransitionsAndGetFinalResponse({
          initialContent: initialResponseContent,
          historyAfterInitialCall: historyAfterLLM,
          executedPromptIndex: executedPromptIndex,
          currentNamedMemory: currentNamedMemory,
          currentBufferSize: currentBufferSize,
      });

      // Update state based on transition result
      const finalResponseContent = transitionResult.finalContent;
      currentNamedMemory = transitionResult.updatedNamedMemory;
      currentBufferSize = transitionResult.updatedBufferSize;
      const indexGeneratingFinalResponse = transitionResult.indexGeneratingLastResponse;
      const nextIndexAfterProcessing = transitionResult.nextTurnIndex;


      // --- Step 6: Store to DB (Optional) and Return Final State ---
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

        // --- Return final content and session state for the *next* turn ---
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
          console.error("[JEST_DEBUG] ERROR CAUGHT in handleNonStreamingFlow's inner prompt access/LLM call try block:", error);
          return { content: "An internal server error occurred during processing.", updatedSessionData: null }; // Avoid saving state on error
      }

  } catch (outerError: any) { // Outer catch starts around line 499
      console.error("[JEST_DEBUG] ERROR CAUGHT in OUTER try block of handleNonStreamingFlow:", outerError);
      return { content: "An internal server error occurred during processing.", updatedSessionData: null };
  }
} // End of handleNonStreamingFlow


// --- Helper Function for Processing Transitions ---
interface TransitionProcessingInput {
    initialContent: string;
    historyAfterInitialCall: ConversationEntry[];
    executedPromptIndex: number;
    currentNamedMemory: NamedMemory;
    currentBufferSize: number;
}

interface TransitionProcessingResult {
    finalContent: string;
    updatedNamedMemory: NamedMemory;
    updatedBufferSize: number;
    indexGeneratingLastResponse: number;
    nextTurnIndex: number;
}

async function processTransitionsAndGetFinalResponse(
    input: TransitionProcessingInput
): Promise<TransitionProcessingResult> {
    let {
        initialContent,
        historyAfterInitialCall,
        executedPromptIndex,
        currentNamedMemory,
        currentBufferSize,
    } = input;

    const executedPromptObj = PROMPT_LIST[executedPromptIndex]; // Get the prompt that just ran
    let indexGeneratingLastResponse = executedPromptIndex; // Track which prompt index is responsible for the final output
    let historyContextForNextStep = historyAfterInitialCall; // Start with history after the main call
    let finalCombinedContent = initialContent || ""; // Initialize with base response
    let nextTurnIndex = executedPromptIndex + 1; // Default next index

    const hasHiddenFlag = executedPromptObj?.autoTransitionHidden === true;
    const hasVisibleFlag = executedPromptObj?.autoTransitionVisible === true;

    if (hasHiddenFlag || hasVisibleFlag) {
        // console.log(`\n[DEBUG][TRANSITION TRIGGER] Prompt ${executedPromptIndex} has an autoTransition flag.`);
        let currentTransitionIndex = executedPromptIndex + 1;

        if (hasHiddenFlag) {
            finalCombinedContent = ""; // Start blank if trigger was hidden
        }

        // Hidden Loop
        while (currentTransitionIndex < PROMPT_LIST.length && PROMPT_LIST[currentTransitionIndex]?.autoTransitionHidden) {
            const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize, conversationHistory: historyAfterHidden } =
                await handleAutoTransitionHidden(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize);
            currentTransitionIndex = updatedIndex;
            currentNamedMemory = updatedNamedMemory ?? {};
            currentBufferSize = updatedBufferSize;
            historyContextForNextStep = historyAfterHidden;
            finalCombinedContent = autoResp ?? ""; // Overwrite
            indexGeneratingLastResponse = currentTransitionIndex - 1; // Last hidden prompt index generated this
        }

        // Visible Loop
        while (currentTransitionIndex < PROMPT_LIST.length && PROMPT_LIST[currentTransitionIndex]?.autoTransitionVisible) {
            const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize, conversationHistory: historyAfterVisible } =
                await handleAutoTransitionVisible(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize);
            currentTransitionIndex = updatedIndex;
            currentNamedMemory = updatedNamedMemory ?? {};
            currentBufferSize = updatedBufferSize;
            historyContextForNextStep = historyAfterVisible;
            if (autoResp) {
                const separator = finalCombinedContent ? "\n\n" : "";
                finalCombinedContent += separator + autoResp; // Append
                indexGeneratingLastResponse = currentTransitionIndex - 1; // Last visible prompt index generated/appended this
            } else {
                break; // Stop if a visible transition fails
            }
        }

        nextTurnIndex = currentTransitionIndex; // Update index after loops

        // Execute the NEXT NORMAL Prompt if transitions landed on one
        if (nextTurnIndex < PROMPT_LIST.length) {
            const nextNormalPromptObj = PROMPT_LIST[nextTurnIndex];
            if (!nextNormalPromptObj?.autoTransitionHidden && !nextNormalPromptObj?.autoTransitionVisible) {
                // console.log(`[DEBUG][POST-TRANSITION] Running final normal prompt ${nextTurnIndex}.`);
                currentBufferSize = updateDynamicBufferMemory(nextNormalPromptObj, currentBufferSize);
                const finalPromptText = nextNormalPromptObj.prompt_text || "";
                const finalPromptWithMemory = injectNamedMemory(finalPromptText, currentNamedMemory);
                let historyForFinalCall = [ { role: "system", content: finalPromptWithMemory }, ...historyContextForNextStep.filter((e) => e.role !== "system") ];
                historyForFinalCall = manageBuffer(historyForFinalCall, currentBufferSize);
                const finalPayload = { model: getModelForCurrentPrompt(nextTurnIndex), temperature: nextNormalPromptObj?.temperature ?? 0, messages: historyForFinalCall };
                const rawFinalAssistantContent = await fetchApiResponseWithRetry(finalPayload);
                const finalAssistantContentCleaned = cleanLlmResponse(rawFinalAssistantContent);

                if (finalAssistantContentCleaned) {
                    const processedFinalContent = processAssistantResponseMemory(finalAssistantContentCleaned, nextNormalPromptObj, currentNamedMemory, nextTurnIndex);
                    const separator = finalCombinedContent ? "\n\n" : "";
                    finalCombinedContent += separator + processedFinalContent; // Append final normal prompt response
                    indexGeneratingLastResponse = nextTurnIndex; // This final prompt generated the last part
                    nextTurnIndex++; // Increment index *after* successful final prompt execution
                }
            }
        }
    }
    // else: No transitions triggered, initial values are correct.

    return {
        finalContent: finalCombinedContent,
        updatedNamedMemory: currentNamedMemory,
        updatedBufferSize: currentBufferSize,
        indexGeneratingLastResponse: indexGeneratingLastResponse,
        nextTurnIndex: nextTurnIndex,
    };
}


// --- Helper: insertImportantMemory (Moved from route.ts) ---
// NOTE: This function MUST return the modified history.
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