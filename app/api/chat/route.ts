// D:\vercel\intro_groq m6\app\api\chat\route.ts

import PROMPT_LIST from "./prompts"; // Correct path
import { NextRequest, NextResponse } from "next/server";
// Import cookies directly
import { cookies } from 'next/headers';

import { handleDatabaseStorageIfNeeded } from "@/utils/databaseHelpers"; // Temporarily commented out // Re-enable import

import {
  validateInput,
  generateRetryMessage,
  fetchApiResponseWithRetry,
  cleanLlmResponse
} from './openaiApiUtils'; // Adjust path if needed

import {
  getModelForCurrentPrompt,
  RollbackOnValidationFailure
} from './promptUtils';

import {
  handleAutoTransitionHidden,
  handleAutoTransitionVisible
} from './autoTransitionUtils'; // Adjust path if needed

import { chainIfNeeded } from './chainUtils';
import {
  injectNamedMemory,
  updateDynamicBufferMemory,
  saveUserInputToMemoryIfNeeded,   // <-- Added missing import
  processAssistantResponseMemory, // <-- Added missing import
  NamedMemory                     // <-- Type import (keep)
} from './memoryUtils';

import { manageBuffer } from './bufferUtils';
// Import session functions (they now use cookies() internally again)
// /* // Temporarily commented out // Re-enable imports
import {
  getSessionCookieData,
  updateSessionCookieData,
  // destroySession, // If needed
  SessionCookieData // Import the type
} from '@/lib/session';
// */

// --- Constants ---
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18";
export const runtime = "nodejs";
export const BUFFER_SIZE = 8; // Default buffer size

// --- Force dynamic rendering ---
export const dynamic = 'force-dynamic';

// --- Interfaces ---
type ConversationEntry = { role: string; content: string };

interface ChatRequestBody {
    messages: ConversationEntry[];
    stream?: boolean; // <-- Keep added optional stream property
}

interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData;
}

interface HandlerResult {
    content: string | null;
    updatedSessionData: Partial<SessionCookieData> | null;
}

// --- MAIN POST Handler ---
export async function POST(req: NextRequest) {
  // console.log("--- JEST TEST: POST HANDLER ENTERED ---"); // <-- REMOVED LOG

  // --- Get Cookie Store Instance ---
  const cookieStore = await cookies(); // <-- Try awaiting cookies()

  // --- 1. Read Session Cookie Data ---
  // Pass the cookieStore instance to the utility function
  const sessionData = await getSessionCookieData(cookieStore); // <-- Pass cookieStore
  // console.log("API Route Start - Initial Session Data from Cookie:", JSON.stringify(sessionData, null, 2));

  // --- 2. Parse Body & Get History ---
  let body: ChatRequestBody;
  let messagesFromClient: ConversationEntry[];
  try {
    body = await req.json();
    if (!body || !Array.isArray(body.messages)) {
      // console.error("Error parsing request body: 'messages' array missing or invalid.", body);
      return NextResponse.json({ message: "'messages' array is missing or invalid in request body." }, { status: 400 });
    }
    messagesFromClient = body.messages;
    // console.log(`📥 Received Payload: ${messagesFromClient.length} messages.`);
    if (messagesFromClient.length > 0) {
        const lastMsg = messagesFromClient[messagesFromClient.length - 1];
        // console.log(`   Last message (${lastMsg.role}): ${lastMsg.content.substring(0, 80)}...`);
    }
  } catch (err) {
    // console.error("Error parsing request body:", err);
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  // --- API Key Check ---
  if (!process.env.OPENAI_API_KEY) {
     // console.error("[FATAL] Missing OPENAI_API_KEY environment variable.");
     return NextResponse.json({ message: 'Server configuration error: Missing API Key.' }, { status: 500 });
  }

  // --- Main Logic ---
  try {
    let result: HandlerResult;

    const processingInput: ConversationProcessingInput = {
        messagesFromClient: messagesFromClient,
        sessionData: sessionData // Pass the initially loaded session data
    };

    if (body.stream === true) { // Check the parsed body, not (body as any) <-- Now valid
        // console.warn("Streaming not fully refactored for hybrid approach yet.");
        return NextResponse.json({ message: 'Streaming not implemented with this state approach yet.' }, { status: 501 });
        // result = await handleStreamingFlow(processingInput); // Needs refactoring
        // Note: handleStreamingFlow would also need cookieStore passed if it modifies session
    } else {
        if (messagesFromClient.length === 0) {
            return NextResponse.json({ message: 'No messages provided in history.' }, { status: 400 });
        }
        // console.log("Calling handleNonStreamingFlow...");
        // Pass the processing input which includes the sessionData read earlier
        result = await handleNonStreamingFlow(processingInput);
        // console.log("handleNonStreamingFlow returned.");
    }

    // === Save State & Send Response ===

    // --- Save Updated Session Data to Cookie ---
    // Check if the handler returned successfully and provided data to save
    if (result && result.updatedSessionData) {
        // console.log("API Route - State to Update Session Cookie:", JSON.stringify(result.updatedSessionData, null, 2));
        // Pass the cookieStore instance AND the update data to the utility function
        await updateSessionCookieData(cookieStore, result.updatedSessionData); // <-- Pass cookieStore
    } else {
        // console.warn("API Route - No updated session data returned from handler or handler failed. Cookie not explicitly saved.");
        // Decide if you need to save even on failure, e.g., resetting index?
        // If handleNonStreamingFlow returns null updatedSessionData on error, this correctly skips saving.
    }

    // --- Send Response ---
    // Check if the handler returned successfully and provided content
    if (result && result.content !== null) {
       const responseContent = result.content;
       // console.log("API Route - Sending response content:", responseContent ? responseContent.substring(0,100)+"..." : "null");
       return new NextResponse(responseContent, {
           status: 200,
           headers: { 'Content-Type': 'text/plain; charset=utf-8' },
       });
    } else {
       // This handles cases where result is undefined (shouldn't happen if try/catch works)
       // OR where result.content is explicitly null (e.g., internal error within the handler)
       // console.error("API Route - Handler function returned null content or result was undefined.");
       // Determine appropriate status code - 500 is generic server error
       return NextResponse.json({ message: 'Processing failed to produce content.' }, { status: 500 });
    }

  } catch (error: any) {
    // Catch errors *outside* the main try block (e.g., initial session read, body parsing)
    // or errors *rethrown* from the main logic block that weren't caught internally
    // console.error("[ERROR] Unhandled exception in POST handler:", error);
    // The specific iron-session check is removed as the pattern is corrected.
    // A generic 500 is appropriate for unexpected errors.
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} // End of POST function


async function handleNonStreamingFlow(
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
    let finalResponseContent = processAssistantResponseMemory(
          assistantContentCleaned,
      currentPromptObj,
          currentNamedMemory,
      currentIndex
      );

    // --- History Context *After* Main LLM Call (for transitions) ---
      let historyAfterLLM = [
      ...historyForLLM,
      { role: "assistant", content: finalResponseContent }
      ];
    if (currentPromptObj.important_memory) {
          historyAfterLLM = insertImportantMemory(historyAfterLLM, finalResponseContent);
      }

    // --- Step 5: Process Transitions ---
    const executedPromptIndex = currentIndex; // The index that just generated the main response
    const executedPromptObj = currentPromptObj;
    let indexGeneratingFinalResponse = executedPromptIndex; // Track which prompt index is responsible for the final output

    let historyContextForNextStep = historyAfterLLM; // Start with history after the main call

  let transitionsWereTriggered = false;
    let finalCombinedContent = finalResponseContent || ""; // Initialize with base response
    let nextIndexAfterProcessing = executedPromptIndex + 1; // Default next index

  const hasHiddenFlag = executedPromptObj?.autoTransitionHidden === true;
  const hasVisibleFlag = executedPromptObj?.autoTransitionVisible === true;

  if (hasHiddenFlag || hasVisibleFlag) {
      // console.log(`\n[DEBUG][TRANSITION TRIGGER] Prompt ${executedPromptIndex} has an autoTransition flag.`);
      transitionsWereTriggered = true;
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
        indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last hidden prompt index generated this
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
          indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last visible prompt index generated/appended this
           } else {
          break; // Stop if a visible transition fails
           }
      }

      nextIndexAfterProcessing = currentTransitionIndex; // Update index after loops

      // Execute the NEXT NORMAL Prompt if transitions landed on one
      if (nextIndexAfterProcessing < PROMPT_LIST.length) {
          const nextNormalPromptObj = PROMPT_LIST[nextIndexAfterProcessing];
          if (!nextNormalPromptObj?.autoTransitionHidden && !nextNormalPromptObj?.autoTransitionVisible) {
          // console.log(`[DEBUG][POST-TRANSITION] Running final normal prompt ${nextIndexAfterProcessing}.`);
               currentBufferSize = updateDynamicBufferMemory(nextNormalPromptObj, currentBufferSize);
          const finalPromptText = nextNormalPromptObj.prompt_text || "";
               const finalPromptWithMemory = injectNamedMemory(finalPromptText, currentNamedMemory);
          let historyForFinalCall = [ { role: "system", content: finalPromptWithMemory }, ...historyContextForNextStep.filter((e) => e.role !== "system") ];
               historyForFinalCall = manageBuffer(historyForFinalCall, currentBufferSize);
               const finalPayload = { model: getModelForCurrentPrompt(nextIndexAfterProcessing), temperature: nextNormalPromptObj?.temperature ?? 0, messages: historyForFinalCall };
               const rawFinalAssistantContent = await fetchApiResponseWithRetry(finalPayload);
               const finalAssistantContentCleaned = cleanLlmResponse(rawFinalAssistantContent);

               if (finalAssistantContentCleaned) {
                    const processedFinalContent = processAssistantResponseMemory(finalAssistantContentCleaned, nextNormalPromptObj, currentNamedMemory, nextIndexAfterProcessing);
                    const separator = finalCombinedContent ? "\n\n" : "";
            finalCombinedContent += separator + processedFinalContent; // Append final normal prompt response
            indexGeneratingFinalResponse = nextIndexAfterProcessing; // This final prompt generated the last part
            nextIndexAfterProcessing++; // Increment index *after* successful final prompt execution
          }
        }
      }
  } else {
      // No transitions triggered by the executed prompt (at executedPromptIndex)
      // indexGeneratingFinalResponse remains executedPromptIndex
      // nextIndexAfterProcessing remains executedPromptIndex + 1
    }

    // Finalize the response content
  finalResponseContent = finalCombinedContent;

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
      console.error("[JEST_DEBUG] ERROR CAUGHT in handleNonStreamingFlow:", error);
      return { content: "An internal server error occurred during processing.", updatedSessionData: null }; // Avoid saving state on error
  } finally {
      // console.log("Exiting handleNonStreamingFlow.");
  }
} // End of handleNonStreamingFlow


// --- insertImportantMemory (Helper used within handleNonStreamingFlow) ---
// NOTE: This function MUST return the modified history.
// It should be called like: historyAfterLLM = insertImportantMemory(historyAfterLLM, ...)
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
// --- handleStreamingFlow ---
// NOTE: This function uses global variables (conversationHistory, currentBufferSize, currentIndex)
// which is inconsistent with the state management in handleNonStreamingFlow.
// It needs significant refactoring to work correctly with the session cookie state model.
// For now, it remains as provided but is likely non-functional in the current setup.
let conversationHistory: ConversationEntry[] = []; // Example global state (problematic)
let currentBufferSize = BUFFER_SIZE; // Example global state (problematic)
let currentIndex = 0; // Example global state (problematic)

async function handleStreamingFlow(incomingMessage: string): Promise<Response> {
  // console.log("[INFO] [STREAM MODE] Received request for streaming.");
  // console.warn("[WARNING] handleStreamingFlow uses outdated global state and needs refactoring for session cookie model.");

  if (!incomingMessage?.trim()) {
    // console.log("[WARN] No User Input Received. Returning Error.");
    return new Response("No input received. Please try again.", { status: 400 });
  }

  // This uses global state, which won't reflect the actual session
  conversationHistory.push({ role: "user", content: incomingMessage });
  conversationHistory = manageBuffer(conversationHistory, currentBufferSize); // Uses global buffer size

  const currentPrompt = PROMPT_LIST[currentIndex]?.prompt_text || "No further prompts."; // Uses global index
  conversationHistory.unshift({ role: "system", content: currentPrompt });

  const payload = {
    model: DEFAULT_OPENAI_MODEL,
    temperature: 0,
    stream: true,
    messages: conversationHistory, // Uses global history
  };

  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) { // Check !resp.ok separately first
    const errorText = await resp.text();
    // console.error("[ERROR] streaming request failed:\n", errorText);
    return new Response("Error calling streaming LLM API.", { status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const transformStream = new TransformStream();
  const writable = transformStream.writable.getWriter();

  (async () => {
    // Check for resp.body *inside* the async IIFE, before using it
    if (!resp.body) {
      // console.error("[ERROR] Response body is null, cannot stream.");
      // Need to handle this error within the async function, maybe close the writer
      await writable.close(); 
      return; // Exit the async function
    }
    try {
      for await (const chunk of streamAsyncIterable(resp.body)) { // Now resp.body is guaranteed non-null here
        const data = decoder.decode(chunk);
        const lines = data.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("data: [DONE]")) {
            await writable.write(encoder.encode(`data: [DONE]\n\n`));
            await writable.close();
            return;
          }
          await writable.write(encoder.encode(`${line}\n`));
        }
      }
    } catch (e) {
      // console.error("[ERROR] in SSE streaming:", e);
      await writable.close(); // Ensure writer is closed on error
    } finally {
       // Ensure writer is closed if loop finishes unexpectedly
       // await writable.close(); // This might cause issues if already closed. Check logic.
    }
  })();

  return new Response(transformStream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


/**
 * Helper to turn a ReadableStream into an async iterable
 */
async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

