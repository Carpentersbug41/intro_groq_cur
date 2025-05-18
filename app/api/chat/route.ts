// D:\vercel\intro_groq m6\app\api\chat\route.ts

// import PROMPT_LIST from "./prompts/prompts"; // Correct path <-- REMOVE THIS LINE
import { NextRequest, NextResponse } from "next/server";
// Import cookies directly
import { cookies } from 'next/headers';

import { handleDatabaseStorageIfNeeded } from "@/utils/databaseHelpers"; // Temporarily commented out // Re-enable import

import { handleNonStreamingFlow } from './handlers/nonStreamingFlow';
import { handleStreamingFlow } from './handlers/streamingFlow';
import { manageBuffer } from './utils/bufferUtils';
import { ConversationProcessingInput, ConversationEntry, ChatRequestBody, HandlerResult } from './types/routeTypes'; // Moved from nonStreamingFlow to types AND Added missing types

// Import session functions (they now use cookies() internally again)
// /* // Temporarily commented out // Re-enable imports
import {
  getSessionCookieData,
  updateSessionCookieData,
  // destroySession, // If needed
  SessionCookieData // Import the type
} from '@/lib/session';
// */
import { DEFAULT_OPENAI_MODEL, OPENAI_API_URL, BUFFER_SIZE } from "./utils/openaiApiUtils";

// --- Constants ---
// Moved -> export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
// Moved -> export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18"; // Already moved
export const runtime = "nodejs";
// Moved -> export const BUFFER_SIZE = 8; // Default buffer size

// --- Force dynamic rendering ---
export const dynamic = 'force-dynamic';

// --- Interfaces ---
// Make these available for the imported nonStreamingFlow
// Moved to routeTypes.ts
// export type ConversationEntry = { role: string; content: string };

// Moved to routeTypes.ts
// export interface ChatRequestBody {
//     messages: ConversationEntry[];
//     stream?: boolean; // <-- Keep added optional stream property
//     essayType?: "opinion" | "ads_type1" | "discussion" | string; // <-- ADD essayType here
// }

// Moved to routeTypes.ts
// export interface HandlerResult {
//     content: string | null;
//     updatedSessionData: Partial<SessionCookieData> | null;
// }

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
  let essayType: string | undefined; // Variable to hold essayType

  try {
    body = await req.json();
    if (!body || !Array.isArray(body.messages)) {
      // console.error("Error parsing request body: 'messages' array missing or invalid.", body);
      return NextResponse.json({ message: "'messages' array is missing or invalid in request body." }, { status: 400 });
    }
    messagesFromClient = body.messages;
    essayType = body.essayType; // <-- Extract essayType from the body
    // console.log(`📥 Received Payload: ${messagesFromClient.length} messages. Essay Type: ${essayType}`);
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

    // Prepare input for the handler, including the essayType
    // Ensure essayType is provided, default to 'opinion' if missing or invalid for safety
    const resolvedEssayType = (essayType === 'opinion' || essayType === 'ads_type1' || essayType === 'discussion' || essayType === 'opinion_conclusion' || essayType === 'opinion_mbp')
                               ? essayType
                               : 'opinion'; // Default if missing or invalid

    // Update the type definition if ConversationProcessingInput now expects essayType
    const processingInput: ConversationProcessingInput = {
        messagesFromClient: messagesFromClient,
        sessionData: sessionData, // Pass the initially loaded session data
        essayType: resolvedEssayType // <-- Pass the resolved essay type
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
        // console.log("Calling handleNonStreamingFlow with essayType:", resolvedEssayType);
        // Pass the processing input which includes the essayType
        result = await handleNonStreamingFlow(processingInput); // Pass the object containing essayType
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
// Moved implementation to handlers/streamingFlow.ts
// async function handleStreamingFlow(
//     incomingMessage: string, // Last user message
//     currentBufferSize: number, // Passed from session
//     currentIndex: number, // Passed from session
//     historyFromClient: ConversationEntry[] // Full history from client
// ): Promise<Response> {
// ... implementation ...
// }


/**
 * Helper to turn a ReadableStream into an async iterable
 */
// Moved implementation to utils/streamUtils.ts
// async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
// ... implementation ...
// }

