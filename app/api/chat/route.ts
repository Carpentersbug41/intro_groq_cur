// D:\vercel\intro_groq m6\app\api\chat\route.ts

import PROMPT_LIST from "./prompts"; // Correct path
import { NextRequest, NextResponse } from "next/server";
// Import cookies directly
import { cookies } from 'next/headers';

import { handleDatabaseStorageIfNeeded } from "@/utils/databaseHelpers"; // Temporarily commented out // Re-enable import

import { handleNonStreamingFlow } from './nonStreamingFlow'; // <-- Import the refactored function
import { handleStreamingFlow } from './streamingFlow'; // <-- Import the new streaming handler

import { manageBuffer } from './bufferUtils'; // Keep if used by streaming flow
// Import session functions (they now use cookies() internally again)
// /* // Temporarily commented out // Re-enable imports
import {
  getSessionCookieData,
  updateSessionCookieData,
  // destroySession, // If needed
  SessionCookieData // Import the type
} from '@/lib/session';
// */
import { DEFAULT_OPENAI_MODEL, OPENAI_API_URL, BUFFER_SIZE } from "./openaiApiUtils";

// --- Constants ---
// Moved -> export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
// Moved -> export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18"; // Already moved
export const runtime = "nodejs";
// Moved -> export const BUFFER_SIZE = 8; // Default buffer size

// --- Force dynamic rendering ---
export const dynamic = 'force-dynamic';

// --- Interfaces ---
// Make these available for the imported nonStreamingFlow
export type ConversationEntry = { role: string; content: string };

export interface ChatRequestBody {
    messages: ConversationEntry[];
    stream?: boolean; // <-- Keep added optional stream property
}

export interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData;
}

export interface HandlerResult {
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
        const lastMessage = messagesFromClient[messagesFromClient.length - 1]?.content;
        if (!lastMessage) {
            return NextResponse.json({ message: 'No message content found for streaming.' }, { status: 400 });
        }
        // Call the imported handleStreamingFlow
        const streamingResponse = await handleStreamingFlow(
            lastMessage,
            sessionData.currentBufferSize ?? BUFFER_SIZE, // Pass buffer size
            sessionData.currentIndex ?? 0, // Pass current index
            messagesFromClient // Pass full history
        );
        return streamingResponse; // Return the streaming Response directly
        // result = await handleStreamingFlow(processingInput); // Needs refactoring
        // Note: handleStreamingFlow would also need cookieStore passed if it modifies session
    } else {
        if (messagesFromClient.length === 0) {
            return NextResponse.json({ message: 'No messages provided in history.' }, { status: 400 });
        }
        // console.log("Calling handleNonStreamingFlow...");
        // Pass the processing input which includes the sessionData read earlier
        // Now calls the imported function
        result = await handleNonStreamingFlow(processingInput);
        // console.log("handleNonStreamingFlow returned.");
    }

    // === Save State & Send Response (Only for Non-Streaming) ===

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


// --- handleStreamingFlow ---
// NOTE: This function uses global variables (conversationHistory, currentBufferSize, currentIndex)
// which is inconsistent with the state management in handleNonStreamingFlow.
// It needs significant refactoring to work correctly with the session cookie state model.
// For now, it remains as provided but is likely non-functional in the current setup.
// TODO: Refactor handleStreamingFlow to accept sessionData and not use global state.
// let conversationHistory: ConversationEntry[] = []; // Example global state (problematic) <- Removed, use historyFromClient
// let currentBufferSize = BUFFER_SIZE; // Example global state (problematic) <- Removed, pass as arg
// let currentIndex = 0; // Example global state (problematic) <- Removed, pass as arg

// Updated to accept necessary state from POST handler
async function handleStreamingFlow(
    incomingMessage: string, // Last user message
    currentBufferSize: number, // Passed from session
    currentIndex: number, // Passed from session
    historyFromClient: ConversationEntry[] // Full history from client
): Promise<Response> {
  // console.log("[INFO] [STREAM MODE] Received request for streaming.");
  console.warn("[WARNING] handleStreamingFlow uses potentially inconsistent state and needs full refactoring for session cookie model.");

  if (!incomingMessage?.trim()) {
    // console.log("[WARN] No User Input Received. Returning Error.");
    return new Response("No input received. Please try again.", { status: 400 });
  }

  // Use the passed history, don't rely on global state
  // Note: Streaming flow doesn't use named memory injection or complex prompt logic from non-streaming yet.
  let streamingHistory = [...historyFromClient]; // Use history sent in request
  streamingHistory = manageBuffer(streamingHistory, currentBufferSize); // Use buffer size from session

  const currentPrompt = PROMPT_LIST[currentIndex]?.prompt_text || "No further prompts."; // Use index from session
  streamingHistory.unshift({ role: "system", content: currentPrompt }); // Add system prompt based on session index

  const payload = {
    model: DEFAULT_OPENAI_MODEL, // Still uses default model
    temperature: 0,
    stream: true,
    messages: streamingHistory, // Use the prepared history
  };
  // console.log("[DEBUG] Streaming Payload:", JSON.stringify(payload, null, 2));

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
            // TODO: Streaming flow needs to update session state upon completion.
            // This currently doesn't happen, leading to desync.
            // console.log("[STREAMING] Reached [DONE]. Session state NOT updated.");
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
       try { await writable.close(); } catch {} // Attempt close, ignore error if already closed
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

