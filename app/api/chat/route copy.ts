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
import { getSession, updateSession, SessionData, defaultSession } from '@/lib/session'; // Import session helpers

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
interface ConversationState {
  currentHistory: { role: string; content: string }[];
  currentIndex: number;
  currentNamedMemory: { [key: string]: string };
  currentBufferSize: number;
}
interface HandlerResult {
    content: string | null;
    updatedState: Partial<SessionData>; // Contains the state to be saved
}

// --- MAIN POST Handler ---
export async function POST(req: NextRequest) {
  // --- Get Cookie Store Once ---
  const cookieStore = cookies(); // Get the cookie store at the start

  // --- Read State from Session ---
  // Pass the cookieStore to getSession
  const session = await getSession(cookieStore);
  const initialState: ConversationState = {
    currentHistory: session.conversationHistory ?? defaultSession.conversationHistory,
    currentIndex: session.currentIndex ?? defaultSession.currentIndex,
    currentNamedMemory: session.namedMemory ?? defaultSession.namedMemory,
    currentBufferSize: session.currentBufferSize ?? defaultSession.currentBufferSize,
  };
  console.log("API Route Start - Initial State from Session:", JSON.stringify(initialState, null, 2));

  // --- Parse Body ---
  let body: any;
  try {
    body = await req.json();
    console.log("📥 Received Payload:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Error parsing request body:", err);
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  // --- API Key Check ---
  if (!process.env.OPENAI_API_KEY) {
     console.error("[FATAL] Missing OPENAI_API_KEY environment variable.");
     return NextResponse.json({ message: 'Server configuration error: Missing API Key.' }, { status: 500 });
  }

  // --- Main Logic ---
  try {
    let result: HandlerResult; // Variable to hold the result from the handler

    if (body.stream === true) {
      // Streaming needs separate handling for session updates
       console.warn("Streaming with session state not fully implemented yet.");
       return NextResponse.json({ message: 'Streaming not implemented with sessions yet.' }, { status: 501 });
      // result = await handleStreamingFlow(body.message, initialState); // Needs modification
    } else {
      // === Pass State ===
      if (!body.message) {
        return NextResponse.json({ message: 'No message provided.' }, { status: 400 });
      }
      // Call the handler function, passing the initial state read from the session
      console.log("Calling handleNonStreamingFlow...");
      // *** IMPORTANT: Ensure handleNonStreamingFlow below is the modified version from Step 4.7 ***
      result = await handleNonStreamingFlow(body.message, initialState);
      console.log("handleNonStreamingFlow returned.");
    }

    // === Save State & Send Response ===

    // --- Save Updated State to Session ---
    // Check if the handler function actually returned updated state information
    if (result && result.updatedState) {
        console.log("API Route - State to Update Session:", JSON.stringify(result.updatedState, null, 2));
        // Pass the cookieStore to updateSession
        await updateSession(cookieStore, result.updatedState);
        // console.log("Session updated."); // Log is now inside updateSession
    } else {
        console.warn("API Route - No updated state returned from handler function. Session not explicitly saved.");
    }

    // --- Send Response ---
    // Check if the handler function returned valid content
    if (result && result.content !== null) {
       console.log("API Route - Sending response content:", result.content ? result.content.substring(0,100)+"..." : "null");
       // Send the chat response content back to the client
       return NextResponse.json({ response: result.content });
    } else {
       // Handle cases where the flow resulted in no response content (e.g., internal error in handler)
       console.error("API Route - Handler function returned null content or result was undefined.");
       return NextResponse.json({ message: 'Processing failed to produce content.' }, { status: 500 });
    }

  } catch (error: any) {
    // Catch any unexpected errors during the POST handling
    console.error("[ERROR] in POST handler:", error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} // End of POST function



async function handleNonStreamingFlow(
  incomingMessage: string,
  initialState: ConversationState // Accept initial state from session
): Promise<HandlerResult> { // Return content + updated state
  console.log("Entering handleNonStreamingFlow with initial state:", JSON.stringify(initialState, null, 2));

  // --- Step 1: Destructure state into local mutable variables ---
  let {
      currentHistory,
      currentIndex,
      currentNamedMemory,
      currentBufferSize
  } = initialState;

  try {
      const userMessage = incomingMessage?.trim();
      console.log("\n[INFO] Received User Input:", userMessage || "[No Input Provided]");
      if (!userMessage) {
          console.log("[WARN] No User Input Received.");
          // Return original state as nothing changed
          return { content: "No input received. Please try again.", updatedState: initialState };
      }

      // --- Step 2: Use local state variables ---
      // Check if conversation should end based on local currentIndex
      // Use >= because index is 0-based
      if (currentIndex >= PROMPT_LIST.length) {
           console.log("[INFO] Conversation Complete (Index out of bounds).");
           // Add final message to local history before returning
           const finalMessage = "Thank you for your responses! Goodbye.";
           currentHistory.push({ role: "assistant", content: finalMessage });
           // Return final state
           return { content: finalMessage, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // Get the prompt object for the *current* step
      const currentPromptObj = PROMPT_LIST[currentIndex];
      const currentPromptText = currentPromptObj?.prompt_text;

      if (!currentPromptText) {
          console.error("[ERROR] Current prompt text is missing at index:", currentIndex);
          // Return original state on error
          return { content: "Internal error: Could not retrieve current prompt.", updatedState: initialState };
      }

      // Save original index for DB storage reference
      const thisPromptIndex = currentIndex;

      const promptValidation = currentPromptObj?.validation;
      const promptValidationNeeded = typeof promptValidation === 'boolean' ? promptValidation : typeof promptValidation === 'string';
      // These flags are just for logging/decision, don't modify state
      const isAutoTransitionHidden = currentPromptObj?.autoTransitionHidden || false;
      const isAutoTransitionVisible = currentPromptObj?.autoTransitionVisible || false;

      console.log("\n[DEBUG] Current Prompt Index:", currentIndex);
      console.log("[DEBUG] Current Prompt Text (snippet):\n", currentPromptText.substring(0, 100) + "...");
      console.log("[DEBUG] Validation needed?", promptValidationNeeded);
      console.log("[DEBUG] AutoTransitionHidden Status:", isAutoTransitionHidden);
      console.log("[DEBUG] AutoTransitionVisible Status:", isAutoTransitionVisible);


      // 1) Insert the system prompt (using local currentHistory and currentNamedMemory)
      // Inject memory into the *current* prompt text before adding it as system message
      const currentPromptWithMemory = injectNamedMemory(currentPromptText, currentNamedMemory);
      currentHistory = [
          { role: "system", content: currentPromptWithMemory },
          ...currentHistory.filter((entry) => entry.role !== "system"),
      ];
      // Log state after system prompt update
      // console.log("[DEBUG] History after system prompt update:", JSON.stringify(currentHistory, null, 2));


      // 2) Add user message & save to memory if needed (using local variables)
      currentHistory.push({ role: "user", content: userMessage });
      console.log("[DEBUG] Added User Input to Conversation History.");
      // Check the *current* prompt object (the one being processed) for saving user input
      if (currentPromptObj?.saveUserInputAsMemory) {
          const memoryKey = currentPromptObj.saveUserInputAsMemory;
          currentNamedMemory[memoryKey] = userMessage;
          console.log(`[MEMORY DEBUG] Saved user input to namedMemory["${memoryKey}"]`);
      }


      // 3) Manage buffer (using local currentHistory and currentBufferSize)
      currentHistory = manageBuffer(currentHistory, currentBufferSize);

      let isStorable = true;
      let finalResponseContent: string | null = null; // To hold the final message string

      // 4) Validation Block (using local variables)
      if (promptValidationNeeded) {
          console.log("[INFO] This prompt requires validation.");
          const customValidation = typeof promptValidation === "string" ? promptValidation : undefined;

          // Pass current prompt *with memory injected* to validation
          const isValid = await validateInput(userMessage, currentPromptWithMemory, customValidation);

          if (!isValid) {
              console.log("[INFO] Validation Failed.");
              isStorable = false;

              const originalIndexBeforeRollback = currentIndex;
              currentIndex = RollbackOnValidationFailure(currentIndex); // Update local currentIndex
              const newPromptObj = PROMPT_LIST[currentIndex]; // Get potentially rolled-back prompt
              const newPromptText = newPromptObj?.prompt_text || "No further prompts.";
              // Inject memory into the *new* prompt for the retry message
              const newPromptWithMemory = injectNamedMemory(newPromptText, currentNamedMemory);
              console.log(`[ROLLBACK] ${currentIndex !== originalIndexBeforeRollback ? `Rolled back to index ${currentIndex}.` : 'No rollback needed.'}`);

              // Generate retry message (pass potentially updated prompt)
              // Assuming generateRetryMessage uses the history passed implicitly or needs refactoring later
              const retryMsg = await generateRetryMessage(
                userMessage,
                newPromptWithMemory,
                currentHistory // Pass the local history state
            );
            finalResponseContent = retryMsg;


              // Fallback Chaining? Check the *new* current prompt object
              if (newPromptObj?.chaining) {
                  console.log("[FALLBACK CHAIN] Chaining retry message...");
                  const chainResult = await chainIfNeeded({
                      initialAssistantContent: retryMsg,
                      currentHistory: currentHistory, // Pass current local state
                      currentIndex: currentIndex,
                      namedMemory: currentNamedMemory,
                      currentBufferSize: currentBufferSize
                  });
                  // Update local state from chain result
                  finalResponseContent = chainResult.finalResponse; // Update response content
                  currentHistory = chainResult.finalHistory;
                  currentIndex = chainResult.finalIndex;
                  currentNamedMemory = chainResult.updatedNamedMemory;
                  currentBufferSize = chainResult.updatedBufferSize;
                  console.log("[FALLBACK CHAIN] Chaining complete.");

                  // Handle auto-transition *after* fallback chaining
                  const lastPromptIndex = currentIndex - 1;
                  if (lastPromptIndex >= 0) {
                      const lastPrompt = PROMPT_LIST[lastPromptIndex];
                      if (lastPrompt?.autoTransitionVisible) {
                          console.log("[FALLBACK CHAIN] Handling autoTransitionVisible...");
                          let combinedVisible = finalResponseContent || "";
                          // Pass current local state to transition handler
                          // Assuming handleAutoTransitionVisible accepts history and index
                          const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                              await handleAutoTransitionVisible(currentHistory, lastPromptIndex);
                          // Update local state
                          currentHistory = updatedConv;
                          currentIndex = updatedIndex;
                          if (autoResp) combinedVisible += "\n\n" + autoResp;
                          console.log("[FALLBACK CHAIN] AutoTransitionVisible complete.");
                          // Return result immediately
                          return { content: combinedVisible, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
                      } else if (lastPrompt?.autoTransitionHidden) {
                          console.log("[FALLBACK CHAIN] Handling autoTransitionHidden...");
                          // Pass current local state to transition handler
                          // Assuming handleAutoTransitionHidden accepts history and index
                          const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                              await handleAutoTransitionHidden(currentHistory, lastPromptIndex);
                          // Update local state
                          currentHistory = updatedConv;
                          currentIndex = updatedIndex;
                          const finalHiddenResult = autoResp || finalResponseContent; // Use chained response as fallback
                          console.log("[FALLBACK CHAIN] AutoTransitionHidden complete.");
                          // Return result immediately
                          return { content: finalHiddenResult, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
                      }
                  }
                  // If chaining happened but no transition, return chained result
                  return { content: finalResponseContent, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };

              } else {
                 // No chaining on validation failure, just add retry message to local history
                 currentHistory.push({ role: "assistant", content: retryMsg });
                 currentHistory = manageBuffer(currentHistory, currentBufferSize); // Buffer after adding retry

                 // Handle auto-transition after simple retry (using local state)
                 const currentPromptAfterRollback = PROMPT_LIST[currentIndex];
                 if (currentPromptAfterRollback?.autoTransitionVisible) {
                     console.log("[DEBUG] Handling autoTransitionVisible after simple retry...");
                     let combinedVisible = retryMsg;
                     // Assuming handleAutoTransitionVisible accepts history and index
                     const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                         await handleAutoTransitionVisible(currentHistory, currentIndex);
                     currentHistory = updatedConv;
                     currentIndex = updatedIndex;
                     if (autoResp) combinedVisible += "\n\n" + autoResp;
                     return { content: combinedVisible, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
                 } else if (currentPromptAfterRollback?.autoTransitionHidden) {
                     console.log("[DEBUG] Handling autoTransitionHidden after simple retry...");
                     // Assuming handleAutoTransitionHidden accepts history and index
                     const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                         await handleAutoTransitionHidden(currentHistory, currentIndex);
                     currentHistory = updatedConv;
                     currentIndex = updatedIndex;
                     const finalHiddenResult = autoResp || retryMsg;
                     return { content: finalHiddenResult, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
                 }
                 // If validation failed, no chain, no transition, return retry message
                 return { content: retryMsg, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
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
      console.log("Proceeding after validation/skip. Current index:", currentIndex);

      // Check for end of conversation AGAIN after potential index increment
      if (currentIndex >= PROMPT_LIST.length) {
           console.log("[INFO] Reached end of prompts after processing validation/skip.");
           // Return final state before attempting to access invalid index
           return { content: "Thank you for your responses! Goodbye.", updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // Update dynamic buffer (using local currentBufferSize)
      const previousPromptObj = PROMPT_LIST[currentIndex - 1]; // Prompt that just finished
      currentBufferSize = updateDynamicBufferMemory(previousPromptObj, currentBufferSize); // Update local variable
      console.log("[DEBUG] Dynamic buffer maybe updated. New buffer size:", currentBufferSize);


      // Prepare next system prompt (using local variables)
      const nextPromptObj = PROMPT_LIST[currentIndex]; // The prompt we are about to ask
      const nextPromptText = nextPromptObj?.prompt_text || "No further prompts.";
      const nextPromptWithMemory = injectNamedMemory(nextPromptText, currentNamedMemory); // Inject memory for the *next* prompt
      console.log("[DEBUG] Preparing for next prompt (index", currentIndex, "):", nextPromptText.substring(0,100)+"...");

      // Update system message in local history for the *next* LLM call
      currentHistory = [
          { role: "system", content: nextPromptWithMemory },
          ...currentHistory.filter((entry) => entry.role !== "system"),
      ];
      // Manage buffer *before* LLM call using the potentially updated size
      currentHistory = manageBuffer(currentHistory, currentBufferSize);

      // Main LLM Call (using local variables)
      const mainPayload = {
          model: getModelForCurrentPrompt(currentIndex), // Model for the *next* prompt
          temperature: nextPromptObj?.temperature ?? 0,
          messages: currentHistory, // History now includes previous user msg and *new* system prompt
      };
      console.log("[DEBUG] Main Payload to LLM (index", currentIndex, "):", JSON.stringify(mainPayload, null, 2));
      const mainApiResponse = await fetchApiResponseWithRetry(mainPayload); // Assuming this returns string | null

      // Process LLM Response
      const rawAssistantContent = mainApiResponse;
      const assistantContent1 = cleanLlmResponse(rawAssistantContent);
      finalResponseContent = assistantContent1; // Store the direct response

      if (!assistantContent1) {
          console.error("[ERROR] Main LLM call failed or returned empty content after retries.");
          finalResponseContent = "I'm sorry, I couldn't process that. Please try again."; // Set error message
          isStorable = false; // Don't store this interaction
          // NOTE: We are NOT adding the error message to history here, just setting it as the response content
      } else {
          console.log("[DEBUG] assistantContent1 from LLM (cleaned):", assistantContent1.substring(0,100)+"...");
          // Add successful LLM response to local history
          currentHistory.push({ role: "assistant", content: assistantContent1 });

          // Save assistant response to named memory if required by the *prompt that just ran* (nextPromptObj)
          if (nextPromptObj?.saveAsNamedMemory) {
              const memoryKey = nextPromptObj.saveAsNamedMemory;
              currentNamedMemory[memoryKey] = assistantContent1;
              console.log(`[MEMORY DEBUG] Saved assistant output to namedMemory["${memoryKey}"]`);
          }

          // IMPORTANT MEMORY INSERTION - Requires insertImportantMemory to be refactored
          // This function previously modified global state directly.
          // It needs to accept history and return the modified history.
          // Commenting out for now to avoid breaking changes until it's refactored.
          /*
          if (nextPromptObj?.important_memory) {
               console.log("[DEBUG] Attempting to insert important memory (requires refactored function)...");
               // currentHistory = insertImportantMemory(currentHistory, assistantContent1); // Call refactored version
          }
          */
      }

      // Manage buffer again *after* adding assistant response (or potential error)
      currentHistory = manageBuffer(currentHistory, currentBufferSize);

      // Chaining after main response (using local variables)
      let lastChainedIndex = -1;
      // Check if the prompt *that just ran* (nextPromptObj) requires chaining
      if (nextPromptObj?.chaining) {
           console.log("[DEBUG] Chaining required for index:", currentIndex);
           const chainResult = await chainIfNeeded({
               initialAssistantContent: assistantContent1, // Chain the response we just got (even if it was an error message?)
               currentHistory: currentHistory, // Pass current local state
               currentIndex: currentIndex,     // Pass index *before* chainIfNeeded modifies it internally
               namedMemory: currentNamedMemory,
               currentBufferSize: currentBufferSize
           });
           // Update local state from chain result
           finalResponseContent = chainResult.finalResponse; // Update final content
           currentHistory = chainResult.finalHistory;
           currentIndex = chainResult.finalIndex; // Update index to where chaining ended
           currentNamedMemory = chainResult.updatedNamedMemory;
           currentBufferSize = chainResult.updatedBufferSize;
           lastChainedIndex = currentIndex - 1; // Index of the last prompt processed by chainIfNeeded
           console.log("[DEBUG] Chaining complete. New index:", currentIndex);

           // Handle immediate visible transition after chain...
           if (lastChainedIndex >= 0) {
               const lastChainedPrompt = PROMPT_LIST[lastChainedIndex];
               if (lastChainedPrompt?.autoTransitionVisible) {
                   console.log("[DEBUG] Handling immediate autoTransitionVisible after chain...");
                   let combinedVisible = finalResponseContent || "";
                   const transitionStartIndex = lastChainedIndex + 1;
                   if (transitionStartIndex < PROMPT_LIST.length) {
                       // Assuming handleAutoTransitionVisible accepts history and index
                       const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                           await handleAutoTransitionVisible(currentHistory, lastChainedIndex);
                       currentHistory = updatedConv;
                       currentIndex = updatedIndex;
                       if (autoResp) combinedVisible += "\n\n" + autoResp;
                       // Return immediately after chained transition
                       if (isStorable && combinedVisible) await handleDatabaseStorageIfNeeded(thisPromptIndex, combinedVisible, userMessage);
                       return { content: combinedVisible, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
                   }
               }
           }
      } else {
           console.log("[DEBUG] No chaining required for index:", currentIndex);
           // finalResponseContent remains the direct LLM response (or error)
      }


      // Auto-Transition Hidden/Visible Loops (using updated local state)
      // These loops run based on the state *after* the main response/chaining

      // Hidden Loop
      // Check index bounds before accessing PROMPT_LIST
      if (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionHidden) {
          console.log("[DEBUG - AUTO-HIDDEN] Entering loop at index:", currentIndex);
          let lastHiddenResponse: string | null = null;
          while (
              currentIndex < PROMPT_LIST.length &&
              PROMPT_LIST[currentIndex]?.autoTransitionHidden
          ) {
              // Assuming handleAutoTransitionHidden accepts history and index
              const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                  await handleAutoTransitionHidden(currentHistory, currentIndex); // Pass current local state
              // Update local state
              currentHistory = updatedConv;
              currentIndex = updatedIndex;
              lastHiddenResponse = autoResp; // Keep track of the last response
          }
          finalResponseContent = lastHiddenResponse || finalResponseContent; // Update final content
          console.log("[DEBUG] Exited autoTransitionHidden loop. Final index:", currentIndex);
          // Store and return immediately
          if (isStorable && finalResponseContent) await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          else if (isStorable) await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage); // Store empty if null
          return { content: finalResponseContent, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // Visible Loop
      // Check index bounds before accessing PROMPT_LIST
      if (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionVisible) {
          console.log("[DEBUG - AUTO-VISIBLE] Entering loop at index:", currentIndex);
          let combinedVisible = finalResponseContent || ""; // Start with content before this loop
          while (
              currentIndex < PROMPT_LIST.length &&
              PROMPT_LIST[currentIndex]?.autoTransitionVisible
          ) {
              // Assuming handleAutoTransitionVisible accepts history and index
              const { conversationHistory: updatedConv, response: autoResp, updatedIndex } =
                  await handleAutoTransitionVisible(currentHistory, currentIndex); // Pass current local state
              // Update local state
              currentHistory = updatedConv;
              currentIndex = updatedIndex;
              if (!autoResp) break; // Stop if a transition step fails
              combinedVisible += "\n\n" + autoResp;
          }
          finalResponseContent = combinedVisible; // Update final content
          console.log("[DEBUG] Exited autoTransitionVisible loop. Final index:", currentIndex);
          // Store and return immediately
          if (isStorable && finalResponseContent) await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          else if (isStorable) await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage); // Store empty if null
          return { content: finalResponseContent, updatedState: { currentIndex, conversationHistory: currentHistory, namedMemory: currentNamedMemory, currentBufferSize } };
      }

      // --- Step 3: Return final state if no transitions caused early return ---
      console.log("[DEBUG] Reached end of non-streaming flow. No further transitions.");

      // Store final interaction if needed (using local isStorable and finalResponseContent)
      if (isStorable) {
          if (finalResponseContent) {
              console.log("[DB-DEBUG] Storing final response text for original prompt index:", thisPromptIndex);
              await handleDatabaseStorageIfNeeded(thisPromptIndex, finalResponseContent, userMessage);
          } else {
              console.log("[DB-DEBUG] Final response was empty/null. Storing user message only for prompt index:", thisPromptIndex);
              await handleDatabaseStorageIfNeeded(thisPromptIndex, "", userMessage);
          }
      } else {
          console.log("[DB-DEBUG] Interaction was marked non-storable. Skipping storage for prompt index:", thisPromptIndex);
      }

      // Return final content and the final state of local variables
      console.log("handleNonStreamingFlow final state:", JSON.stringify({ currentIndex, currentNamedMemory, currentBufferSize }, null, 2)); // Log subset of final state
      return {
          content: finalResponseContent,
          updatedState: {
              currentIndex: currentIndex,
              conversationHistory: currentHistory,
              namedMemory: currentNamedMemory,
              currentBufferSize: currentBufferSize
          }
      };

  } catch (error: any) {
      console.error("[ERROR] Unhandled exception in handleNonStreamingFlow:", error);
      // Return null content and the state as it was initially passed in
      return { content: null, updatedState: initialState };
  } finally {
      console.log("Exiting handleNonStreamingFlow.");
  }
} // End of handleNonStreamingFlow


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



