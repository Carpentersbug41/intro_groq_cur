// D:\vercel\intro_groq m6\app\api\chat\route.ts

import PROMPT_LIST from "./prompts"; // Correct path
import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers'; // Import cookies from next/headers

import { handleDatabaseStorageIfNeeded } from "@/utils/databaseHelpers";

import {
  validateInput,
  generateRetryMessage,
  // fetchApiResponse, // Likely unused now if only using fetchApiResponseWithRetry
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
import { injectNamedMemory, updateDynamicBufferMemory } from './memoryUtils';

import { manageBuffer } from './bufferUtils';
import {
  getSessionCookieData,
  updateSessionCookieData,
  SessionCookieData // Import the type
} from '@/lib/session'; // Use the modified session helpers

// --- Constants ---
// Export constants needed by other modules if necessary
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18";


export const runtime = "nodejs";

// Default buffer size constant - Used by defaultSession
export const BUFFER_SIZE = 8;

// --- Force dynamic rendering ---
// Tells Next.js this route uses dynamic functions like cookies()
export const dynamic = 'force-dynamic';

// --- Interfaces ---
type ConversationEntry = { role: string; content: string };

interface ChatRequestBody {
    messages: ConversationEntry[];
}

interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData; // Assumes SessionCookieData is imported from '@/lib/session'
}

interface HandlerResult {
    content: string | null;
    updatedSessionData: Partial<SessionCookieData> | null; // Assumes SessionCookieData is imported
}

// --- MAIN POST Handler ---
export async function POST(req: NextRequest) {

  // --- 1. Read Session Cookie Data ---
  const sessionData = await getSessionCookieData();
  console.log("API Route Start - Initial Session Data from Cookie:", JSON.stringify(sessionData, null, 2));

// --- 2. Parse Body & Get History ---
let body: ChatRequestBody; // Use the interface defined earlier
let messagesFromClient: ConversationEntry[]; // Use the interface defined earlier
try {
  // Attempt to parse the JSON body of the request
  body = await req.json();

  // --- Validate that messages array exists and is an array ---
  // Check if the parsed body exists, if it has a 'messages' property,
  // and if that 'messages' property is actually an array.
  if (!body || !Array.isArray(body.messages)) {
      // Log the problematic body for debugging
      console.error("Error parsing request body: 'messages' array missing or invalid.", body);
      // Return a 400 Bad Request response if validation fails
      return NextResponse.json({ message: "'messages' array is missing or invalid in request body." }, { status: 400 });
  }

  // If validation passes, assign the messages array to our variable
  messagesFromClient = body.messages;

  // Log confirmation and details about the received payload
  console.log(`📥 Received Payload: ${messagesFromClient.length} messages.`);
  // Optional: Log snippet of the last message for context, checking if the array is not empty first
  if (messagesFromClient.length > 0) {
      const lastMsg = messagesFromClient[messagesFromClient.length - 1];
      console.log(`   Last message (${lastMsg.role}): ${lastMsg.content.substring(0, 80)}...`);
  }
} catch (err) {
  // Catch any errors during the req.json() parsing process (e.g., invalid JSON)
  console.error("Error parsing request body:", err);
  // Return a 400 Bad Request response indicating invalid JSON
  return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
}
// --- If execution reaches here, 'messagesFromClient' holds the valid array ---

  // --- API Key Check --- (Keep as is)
  if (!process.env.OPENAI_API_KEY) {
     console.error("[FATAL] Missing OPENAI_API_KEY environment variable.");
     return NextResponse.json({ message: 'Server configuration error: Missing API Key.' }, { status: 500 });
  }

  // --- Main Logic ---
  try {
    let result: HandlerResult; // Uses updated HandlerResult type

    // --- Prepare Input for Logic Function ---
    const processingInput: ConversationProcessingInput = {
        messagesFromClient: messagesFromClient, // History from body
        sessionData: sessionData              // State from cookie
    };

    // Non-streaming flow (Streaming needs separate refactoring)
    // Check if streaming was requested (assuming client might send `stream: true` in body)
    if ((body as any).stream === true) {
        console.warn("Streaming not fully refactored for hybrid approach yet.");
        // Pass necessary data to streaming handler if/when refactored
        // For now, return error or handle simply
        return NextResponse.json({ message: 'Streaming not implemented with this state approach yet.' }, { status: 501 });
        // result = await handleStreamingFlow(processingInput); // Needs refactoring
    } else {
        // Check if client sent any messages
        if (messagesFromClient.length === 0) {
            return NextResponse.json({ message: 'No messages provided in history.' }, { status: 400 });
        }
        console.log("Calling handleNonStreamingFlow...");
        result = await handleNonStreamingFlow(processingInput); // Pass combined input
        console.log("handleNonStreamingFlow returned.");
    }

    // === Save State & Send Response ===

    // --- Save Updated Session Data to Cookie ---
    if (result && result.updatedSessionData) {
        console.log("API Route - State to Update Session Cookie:", JSON.stringify(result.updatedSessionData, null, 2));
        await updateSessionCookieData(result.updatedSessionData); // Use new function
    } else {
        console.warn("API Route - No updated session data returned from handler. Cookie not explicitly saved.");
    }

    // --- Send Response --- (Keep as is, uses result.content)
    if (result && result.content !== null) {
       const responseContent = result.content;
       console.log("API Route - Sending response content:", responseContent ? responseContent.substring(0,100)+"..." : "null");
       return new NextResponse(responseContent, {
           status: 200,
           headers: {
               'Content-Type': 'text/plain; charset=utf-8',
           },
       });
    } else {
       console.error("API Route - Handler function returned null content or result was undefined.");
       return NextResponse.json({ message: 'Processing failed to produce content.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[ERROR] in POST handler:", error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} // End of POST function



async function handleNonStreamingFlow(
  input: ConversationProcessingInput // Accept the combined input type
): Promise<HandlerResult> { // Return type includes ONLY cookie updates
  const { messagesFromClient, sessionData } = input;

  // +++ LOG 0: Inspect the input sessionData object DIRECTLY +++
  console.log(`>>> [DEBUG][LOG 0] Inside handleNonStreamingFlow - input.sessionData: typeof = ${typeof sessionData}, Value = ${JSON.stringify(sessionData)}`);

  console.log("Entering handleNonStreamingFlow with session data:", JSON.stringify(sessionData, null, 2)); // Keep original log too
  console.log(`   and ${messagesFromClient.length} messages from client.`);

  // --- Step 1: Destructure session state into local mutable variables ---
  let {
      currentIndex,
      currentNamedMemory, // This is the variable we are tracking
      currentBufferSize
  } = sessionData;

  // +++ LOG 1: Immediately after destructuring (Keep this log) +++
  console.log(`>>> [DEBUG][LOG 1] After destructuring: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);

  // +++ ADD ROBUST DEFAULTING (Temporary Fix/Test) +++
  // If LOG 1 shows undefined, this will force it to be an object for the rest of the function execution.
  // This helps confirm if the issue is solely the initial value being undefined.
  if (typeof currentNamedMemory === 'undefined' || currentNamedMemory === null) { // Also check for null
      console.warn(">>> [DEBUG] currentNamedMemory was undefined or null after destructuring! Forcing to {}.");
      currentNamedMemory = {};
  }


  // --- Use history from client directly ---
  let currentHistory: ConversationEntry[] = [...messagesFromClient]; // Start with client history

  // --- Get the latest user message (assuming it's the last one) ---
  const userMessageEntry = currentHistory[currentHistory.length - 1];
  if (!userMessageEntry || userMessageEntry.role !== 'user') {
      console.error("[ERROR] handleNonStreamingFlow: Last message is not from user.");
      return { content: "Internal error: Invalid history state.", updatedSessionData: null };
  }
  const userMessage = userMessageEntry.content;

  try {
      console.log("\n[INFO] Processing User Input:", userMessage.substring(0, 100) + "...");

      // --- Step 2: Use local state variables (currentIndex, etc.) and currentHistory ---

      if (currentIndex >= PROMPT_LIST.length) {
           console.log("[INFO] Conversation Complete (Index out of bounds).");
           const finalMessage = "Thank you for your responses! Goodbye.";
           // Return final message content and the final session state for the cookie
           return {
               content: finalMessage,
               updatedSessionData: { currentIndex, namedMemory: currentNamedMemory ?? {}, currentBufferSize } // Ensure object return
           };
      }

      const currentPromptObj = PROMPT_LIST[currentIndex];
      const currentPromptText = currentPromptObj?.prompt_text;

      if (!currentPromptText) {
          console.error("[ERROR] Current prompt text is missing at index:", currentIndex);
          return { content: "Internal error: Could not retrieve current prompt.", updatedSessionData: null };
      }

      const thisPromptIndex = currentIndex; // Keep for DB storage if needed

      const promptValidation = currentPromptObj?.validation;
      const promptValidationNeeded = typeof promptValidation === 'boolean' ? promptValidation : typeof promptValidation === 'string';
      const isAutoTransitionHidden = currentPromptObj?.autoTransitionHidden || false; // Keep
      const isAutoTransitionVisible = currentPromptObj?.autoTransitionVisible || false; // Keep

      console.log("\n[DEBUG] Current Prompt Index:", currentIndex);
      console.log("[DEBUG] Current Prompt Text (snippet):\n", currentPromptText.substring(0, 100) + "...");
      console.log("[DEBUG] Validation needed?", promptValidationNeeded);
      console.log("[DEBUG] AutoTransitionHidden Status:", isAutoTransitionHidden);
      console.log("[DEBUG] AutoTransitionVisible Status:", isAutoTransitionVisible);

      // 1) Prepare System Prompt & History for LLM/Validation
      // +++ LOG 2: Before first injection +++
      console.log(`>>> [DEBUG][LOG 2] Before injectNamedMemory (currentPrompt): typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      const currentPromptWithMemory = injectNamedMemory(currentPromptText, currentNamedMemory);
      const historyForLLM = [
          { role: "system", content: currentPromptWithMemory },
          ...currentHistory.filter((entry) => entry.role !== "system"),
      ];

      // 2) Save user input to memory if needed (Keep)
      // +++ LOG 3: Before user input save block +++
      console.log(`>>> [DEBUG][LOG 3] Before saveUserInputAsMemory block: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      if (currentPromptObj?.saveUserInputAsMemory) {
          const memoryKey = currentPromptObj.saveUserInputAsMemory;
          if (currentNamedMemory) { // Check added previously
              currentNamedMemory[memoryKey] = userMessage;
              console.log(`[MEMORY DEBUG] Saved user input to namedMemory["${memoryKey}"]`);
          } else {
              console.error(`[ERROR] Attempted to save user input, but currentNamedMemory was undefined!`);
          }
          // +++ LOG 3b: After user input save block +++
          console.log(`>>> [DEBUG][LOG 3b] After saveUserInputAsMemory block: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      }

      let isStorable = true; // Keep
      let finalResponseContent: string | null = null; // Keep

      // 4) Validation Block (Keep logic, modify return on failure)
      if (promptValidationNeeded) {
          console.log("[INFO] This prompt requires validation.");
          const customValidation = typeof promptValidation === "string" ? promptValidation : undefined;
          const isValid = await validateInput(userMessage, currentPromptWithMemory, customValidation);

          if (!isValid) {
              console.log("[INFO] Validation Failed.");
              isStorable = false; // Keep

              // +++ LOG 4: Inside validation failure +++
              console.log(`>>> [DEBUG][LOG 4] Validation FAILED. Before potential chain/transition: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);

              const originalIndexBeforeRollback = currentIndex; // Keep
              currentIndex = RollbackOnValidationFailure(currentIndex); // Update local currentIndex
              const newPromptObj = PROMPT_LIST[currentIndex]; // Keep
              const newPromptText = newPromptObj?.prompt_text || "No further prompts."; // Keep
              const newPromptWithMemory = injectNamedMemory(newPromptText, currentNamedMemory); // Keep
              console.log(`[ROLLBACK] ${currentIndex !== originalIndexBeforeRollback ? `Rolled back to index ${currentIndex}.` : 'No rollback needed.'}`); // Keep

              const retryMsg = await generateRetryMessage(userMessage, newPromptWithMemory, historyForLLM);
              finalResponseContent = retryMsg; // Keep

              if (newPromptObj?.chaining) {
                  console.log("[FALLBACK CHAIN] Chaining retry message... [NEEDS REVIEW FOR HYBRID MODEL]");
                  const chainResult = await chainIfNeeded({
                      initialAssistantContent: retryMsg,
                      currentHistory: historyForLLM,
                      currentIndex: currentIndex,
                      namedMemory: currentNamedMemory,
                      currentBufferSize: currentBufferSize
                  });
                  finalResponseContent = chainResult.finalResponse;
                  currentIndex = chainResult.finalIndex;
                  currentNamedMemory = chainResult.updatedNamedMemory ?? {}; // Robust assignment
                  currentBufferSize = chainResult.updatedBufferSize;
                  console.log("[FALLBACK CHAIN] Chaining complete.");
                  // +++ LOG 4b: After validation fail chain +++
                  console.log(`>>> [DEBUG][LOG 4b] After validation fail chain: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);

                  const lastPromptIndex = currentIndex - 1;
                  if (lastPromptIndex >= 0) {
                      const lastPrompt = PROMPT_LIST[lastPromptIndex];
                      if (lastPrompt?.autoTransitionVisible) {
                          console.log("[FALLBACK CHAIN] Handling autoTransitionVisible... [NEEDS REVIEW FOR HYBRID MODEL]");
                          let combinedVisible = finalResponseContent || "";
                          // Pass state to transition function
                          const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                              await handleAutoTransitionVisible(chainResult.finalHistory, lastPromptIndex, currentNamedMemory, currentBufferSize);
                          currentIndex = updatedIndex;
                          currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
                          currentBufferSize = updatedBufferSize;
                          if (autoResp) combinedVisible += "\n\n" + autoResp;
                          finalResponseContent = combinedVisible; // Update final content
                          console.log("[FALLBACK CHAIN] AutoTransitionVisible complete.");
                          return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
                      } else if (lastPrompt?.autoTransitionHidden) {
                          console.log("[FALLBACK CHAIN] Handling autoTransitionHidden... [NEEDS REVIEW FOR HYBRID MODEL]");
                          // Pass state to transition function
                          const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                              await handleAutoTransitionHidden(chainResult.finalHistory, lastPromptIndex, currentNamedMemory, currentBufferSize);
                          currentIndex = updatedIndex;
                          currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
                          currentBufferSize = updatedBufferSize;
                          const finalHiddenResult = autoResp || finalResponseContent;
                          finalResponseContent = finalHiddenResult; // Update final content
                          console.log("[FALLBACK CHAIN] AutoTransitionHidden complete.");
                          return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
                      }
                  }
                  return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };

              } else { // No chaining on validation fail
                 console.log("[DEBUG] No chaining on validation failure.");
                 const currentPromptAfterRollback = PROMPT_LIST[currentIndex];
                 if (currentPromptAfterRollback?.autoTransitionVisible) {
                     console.log("[DEBUG] Handling autoTransitionVisible after simple retry... [NEEDS REVIEW FOR HYBRID MODEL]");
                     let combinedVisible = retryMsg;
                     // Pass state to transition function
                     const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                         await handleAutoTransitionVisible(historyForLLM, currentIndex, currentNamedMemory, currentBufferSize);
                     currentIndex = updatedIndex;
                     currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
                     currentBufferSize = updatedBufferSize;
                     if (autoResp) combinedVisible += "\n\n" + autoResp;
                     finalResponseContent = combinedVisible; // Update final content
                     return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
                 } else if (currentPromptAfterRollback?.autoTransitionHidden) {
                     console.log("[DEBUG] Handling autoTransitionHidden after simple retry... [NEEDS REVIEW FOR HYBRID MODEL]");
                     // Pass state to transition function
                     const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                         await handleAutoTransitionHidden(historyForLLM, currentIndex, currentNamedMemory, currentBufferSize);
                     currentIndex = updatedIndex;
                     currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
                     currentBufferSize = updatedBufferSize;
                     const finalHiddenResult = autoResp || retryMsg;
                     finalResponseContent = finalHiddenResult; // Update final content
                     return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
                 }
                 return { content: retryMsg, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory ?? {}, currentBufferSize } };
              }
          } else {
              // Validation Succeeded
              console.log("[INFO] Validation Succeeded.");
              currentIndex++; // Increment local index
          }
      } else {
          // No validation needed
          console.log("[INFO] No validation needed.");
          currentIndex++; // Increment local index
      }

      // --- Main Flow if Validation Passed or Skipped ---
      // +++ LOG 5: Start of main flow +++
      console.log(`>>> [DEBUG][LOG 5] Start of main flow (after validation/skip). typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      console.log("Proceeding after validation/skip. New target index:", currentIndex);

      // Check if we've already processed all prompts
      if (currentIndex >= PROMPT_LIST.length) {
           console.log("[INFO] Reached end of prompts after processing validation/skip.");
           return {
               content: "Thank you for your responses! Goodbye.",
               updatedSessionData: { currentIndex, namedMemory: currentNamedMemory ?? {}, currentBufferSize } // Ensure object return
           };
      }

      // Update dynamic buffer size based on the prompt that just finished (previous one)
      const previousPromptObj = PROMPT_LIST[currentIndex - 1]; // Get the prompt obj that led to this point
      const newBufferSize = updateDynamicBufferMemory(previousPromptObj, currentBufferSize);
       if (newBufferSize !== currentBufferSize) {
           console.log(`[BUFFER DYNAMIC] Buffer size changed from ${currentBufferSize} to ${newBufferSize}`);
           currentBufferSize = newBufferSize; // Update local buffer size state
       }
      console.log("[DEBUG] Effective buffer size for next call:", currentBufferSize);

      // Prepare the *next* system prompt (the one we are about to send to the LLM)
      const nextPromptObj = PROMPT_LIST[currentIndex]; // Get the config for the upcoming LLM call
      const nextPromptText = nextPromptObj?.prompt_text || "No further prompts.";
      // +++ LOG 6: Before second injection +++
      console.log(`>>> [DEBUG][LOG 6] Before injectNamedMemory (nextPrompt): typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      const nextPromptWithMemory = injectNamedMemory(nextPromptText, currentNamedMemory); // This is where the log showed undefined before
      console.log("[DEBUG] Preparing for next prompt (index", currentIndex, "):", nextPromptWithMemory.substring(0,100)+"..."); // Log the injected prompt

      // Prepare conversation history for the *actual* LLM call
      let historyForNextLLM = [
          { role: "system", content: nextPromptWithMemory },
          ...currentHistory.filter((entry) => entry.role !== "system"),
      ];
      historyForNextLLM = manageBuffer(historyForNextLLM, currentBufferSize);

      // Main LLM Call
      const mainPayload = {
          model: getModelForCurrentPrompt(currentIndex),
          temperature: nextPromptObj?.temperature ?? 0,
          messages: historyForNextLLM,
      };
      console.log("[DEBUG] Main Payload to LLM (index", currentIndex, "):", JSON.stringify(mainPayload, null, 2));
      const mainApiResponse = await fetchApiResponseWithRetry(mainPayload);

      const rawAssistantContent = mainApiResponse;
      const assistantContent1 = cleanLlmResponse(rawAssistantContent);
      finalResponseContent = assistantContent1;

      if (!assistantContent1) {
          console.error("[ERROR] Main LLM call failed or returned empty content after retries.");
          finalResponseContent = "I'm sorry, I couldn't process that. Please try again.";
          isStorable = false;
          return {
              content: finalResponseContent,
              updatedSessionData: { currentIndex, namedMemory: currentNamedMemory ?? {}, currentBufferSize } // Ensure object return
          };
      } else {
          console.log("[DEBUG] assistantContent1 from LLM (cleaned):", assistantContent1.substring(0,100)+"...");

          // ***** CORRECTED MEMORY SAVING *****
          if (previousPromptObj?.saveAsNamedMemory) {
              const memoryKey = previousPromptObj.saveAsNamedMemory;
              // +++ LOG 7: Before assistant output save +++
              console.log(`>>> [DEBUG][LOG 7] Before saving assistant output: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
              if (currentNamedMemory) { // Check added previously
                  currentNamedMemory[memoryKey] = assistantContent1; // This is where the error occurs
                  console.log(`[MEMORY DEBUG] Saved assistant output to namedMemory["${memoryKey}"] = "${currentNamedMemory[memoryKey]}"`);
              } else {
                  console.error(`[ERROR] Attempted to save assistant output for key "${memoryKey}", but currentNamedMemory was undefined!`);
              }
              // +++ LOG 7b: After assistant output save +++
               console.log(`>>> [DEBUG][LOG 7b] After saving assistant output: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
          }
          // ... (important_memory comment) ...
      }

      // --- Chaining (Keep block, but needs review) ---
      let lastChainedIndex = -1;
      if (nextPromptObj?.chaining) {
           console.log("[DEBUG] Chaining required for index:", currentIndex, "[NEEDS REVIEW FOR HYBRID MODEL]");
           const chainResult = await chainIfNeeded({
               initialAssistantContent: assistantContent1,
               currentHistory: historyForNextLLM,
               currentIndex: currentIndex,
               namedMemory: currentNamedMemory,
               currentBufferSize: currentBufferSize
           });
           finalResponseContent = chainResult.finalResponse;
           currentIndex = chainResult.finalIndex;
           currentNamedMemory = chainResult.updatedNamedMemory ?? {}; // Robust assignment
           currentBufferSize = chainResult.updatedBufferSize;
           lastChainedIndex = currentIndex - 1;
           console.log("[DEBUG] Chaining complete. New index:", currentIndex);
           // +++ LOG 7c: After main flow chain +++
           console.log(`>>> [DEBUG][LOG 7c] After main flow chain: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);

           if (lastChainedIndex >= 0) {
               const lastChainedPrompt = PROMPT_LIST[lastChainedIndex];
               if (lastChainedPrompt?.autoTransitionVisible) {
                   console.log("[DEBUG] Handling immediate autoTransitionVisible after chain... [NEEDS REVIEW FOR HYBRID MODEL]");
                   let combinedVisible = finalResponseContent || "";
                   // Pass state to transition function
                   const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                       await handleAutoTransitionVisible(chainResult.finalHistory, lastChainedIndex, currentNamedMemory, currentBufferSize);
                   currentIndex = updatedIndex;
                   currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
                   currentBufferSize = updatedBufferSize;
                   if (autoResp) combinedVisible += "\n\n" + autoResp;
                   finalResponseContent = combinedVisible; // Update final content
                   return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
               }
               // NOTE: No autoTransitionHidden check here in the original code after chaining
           }
           return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
      } else {
           console.log("[DEBUG] No chaining required for index:", currentIndex);
      }


      // --- Auto-Transition Hidden/Visible Loops ---
      // Hidden Loop
      if (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionHidden) {
          console.log("[DEBUG - AUTO-HIDDEN] Entering loop at index:", currentIndex, "[NEEDS REVIEW FOR HYBRID MODEL]");
          // *** RESTORED CONDITION ***
          while (
              currentIndex < PROMPT_LIST.length &&
              PROMPT_LIST[currentIndex]?.autoTransitionHidden
          ) {
              // +++ LOG 7d: Before hidden transition call +++
              console.log(`>>> [DEBUG][LOG 7d] Before hidden transition call: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
              const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                  await handleAutoTransitionHidden(historyForNextLLM, currentIndex, currentNamedMemory, currentBufferSize); // Pass state
              currentIndex = updatedIndex;
              currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
              currentBufferSize = updatedBufferSize;
              finalResponseContent = autoResp ?? finalResponseContent; // Update final content with last hidden response if available
          }
          console.log("[DEBUG] Exited autoTransitionHidden loop. Final index:", currentIndex);
          // Store and return immediately
          if (isStorable && finalResponseContent) await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          else if (isStorable) await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage);
          return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // Visible Loop
      if (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionVisible) {
          console.log("[DEBUG - AUTO-VISIBLE] Entering loop at index:", currentIndex, "[NEEDS REVIEW FOR HYBRID MODEL]");
          let combinedVisible = finalResponseContent || ""; // Start with content determined before this loop
          // *** RESTORED CONDITION ***
          while (
              currentIndex < PROMPT_LIST.length &&
              PROMPT_LIST[currentIndex]?.autoTransitionVisible
          ) {
               // +++ LOG 7e: Before visible transition call +++
               console.log(`>>> [DEBUG][LOG 7e] Before visible transition call: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
               const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize } =
                  await handleAutoTransitionVisible(historyForNextLLM, currentIndex, currentNamedMemory, currentBufferSize); // Pass state
               currentIndex = updatedIndex;
               currentNamedMemory = updatedNamedMemory ?? {}; // Robust assignment
               currentBufferSize = updatedBufferSize;
               if (!autoResp) break; // Stop if a visible transition step returns no response
               combinedVisible += "\n\n" + autoResp; // Append the response from this step
          }
          finalResponseContent = combinedVisible; // The final content is the combined string
          console.log("[DEBUG] Exited autoTransitionVisible loop. Final index:", currentIndex);
          // Store the combined result and return immediately
          if (isStorable && finalResponseContent) await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          else if (isStorable) await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage);
          return { content: finalResponseContent, updatedSessionData: { currentIndex, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // --- Step 3: Return final state if no transitions caused early return ---
      console.log("[DEBUG] Reached end of non-streaming flow processing for this request. No further transitions triggered immediate return.");

      // Store final interaction result if needed (Keep)
      if (isStorable) {
          if (finalResponseContent !== null && finalResponseContent !== undefined) {
              await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          } else {
              await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage);
          }
      } else {
          console.log("[DB-DEBUG] Interaction was marked non-storable. Skipping storage for prompt index:", thisPromptIndex);
      }

      // +++ LOG 8: Before final return +++
      console.log(`>>> [DEBUG][LOG 8] Before final return: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      console.log("handleNonStreamingFlow final session state to save:", JSON.stringify({ currentIndex, namedMemory: currentNamedMemory, currentBufferSize }, null, 2));
      return {
          content: finalResponseContent,
          updatedSessionData: {
              currentIndex: currentIndex,
              namedMemory: currentNamedMemory ?? {}, // Ensure object return
              currentBufferSize: currentBufferSize
          }
      };

  } catch (error: any) {
      console.error("[ERROR] Unhandled exception in handleNonStreamingFlow:", error);
      // +++ LOG 9: Inside error catch +++
      console.log(`>>> [DEBUG][LOG 9 - ERROR CATCH] State before error return: typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`);
      return { content: "An internal server error occurred during processing.", updatedSessionData: null };
  } finally {
      console.log("Exiting handleNonStreamingFlow.");
  }
} //

/******************************************
 * handleStreamingFlow (No Changes)
 ******************************************/
async function handleStreamingFlow(incomingMessage: string): Promise<Response> {
  console.log("[INFO] [STREAM MODE] Received request for streaming.");

  if (!incomingMessage?.trim()) {
    console.log("[WARN] No User Input Received. Returning Error.");
    return new Response("No input received. Please try again.", { status: 400 });
  }

  // We'll do a *very simple* streaming approach:
  // 1) Insert user message into conversation
  // 2) Build a payload with `stream: true`
  // 3) Return SSE with partial tokens

  // If you want to incorporate EXACT chaining/validation logic in streaming mode,
  // you can replicate the steps from handleNonStreamingFlow. For brevity, we just do a single streamed response.

  conversationHistory.push({ role: "user", content: incomingMessage });
  conversationHistory = manageBuffer(conversationHistory, currentBufferSize);

  // Use the last system prompt or a fallback
  const currentPrompt = PROMPT_LIST[currentIndex]?.prompt_text || "No further prompts.";
  conversationHistory.unshift({ role: "system", content: currentPrompt });

  // Build streaming payload
  const payload = {
    model: DEFAULT_OPENAI_MODEL,
    temperature: 0,
    stream: true, // <--- important
    messages: conversationHistory,
  };

  // Make streaming call
  const resp = await fetch(OPENAI_API_URL
, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok || !resp.body) {
    const errorText = await resp.text();
    console.error("[ERROR] streaming request failed:\n", errorText);
    return new Response("Error calling streaming LLM API.", { status: 500 });
  }

  // We'll convert the OpenAI-style SSE from GROQ into a similar SSE for the client
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream();
  const writable = transformStream.writable.getWriter();

  (async () => {
    try {
      for await (const chunk of streamAsyncIterable(resp.body)) {
        const data = decoder.decode(chunk);

        // The OpenAI SSE data lines often look like: 
        // data: {...}\n
        // data: {...}\n
        // data: [DONE]\n
        //
        // We'll just pass them along as-is to the client in an SSE format.
        const lines = data.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("data: [DONE]")) {
            // End of stream
            await writable.write(encoder.encode(`data: [DONE]\n\n`));
            await writable.close();
            return;
          }
          // Otherwise, pass the chunk along
          await writable.write(encoder.encode(`${line}\n`));
        }
      }
    } catch (e) {
      console.error("[ERROR] in SSE streaming:", e);
      await writable.close();
    }
  })();

  // Return the readable end of the TransformStream as our SSE
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

// ---------------------------------------------------------------------------------
// 1) Helper Function: Insert Important Memory (Place Before POST)
// ---------------------------------------------------------------------------------
function insertImportantMemory(content: string) {
  const systemIndex = conversationHistory.findIndex((msg) => msg.role === "system");
  let insertIndex = systemIndex + 1;

  // Ensure important memory lines are stored in order
  while (
    insertIndex < conversationHistory.length &&
    conversationHistory[insertIndex].role === "assistant" &&
    conversationHistory[insertIndex].content.trim().startsWith("Important_memory:")
  ) {
    insertIndex++;
  }

  // Insert the important memory entry
  conversationHistory.splice(insertIndex, 0, {
    role: "assistant",
    content: `Important_memory: ${content}`
  });

  console.log("[DEBUG] Important_memory inserted at index:", insertIndex);
}



