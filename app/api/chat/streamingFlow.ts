import { Response } from 'next/server'; // Use Response directly
import PROMPT_LIST from "./prompts";
import { manageBuffer } from './bufferUtils';
import { DEFAULT_OPENAI_MODEL, OPENAI_API_URL } from './openaiApiUtils'; // Import constants
import { ConversationEntry } from './routeTypes'; // Import type

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


// NOTE: This function uses state passed as arguments.
// It needs significant refactoring to work correctly with the session cookie state model
// for *updating* the session state after the stream completes.
// TODO: Refactor handleStreamingFlow to integrate session updates.
export async function handleStreamingFlow(
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

  // Ensure OPENAI_API_KEY is checked before fetch
  if (!process.env.OPENAI_API_KEY) {
     console.error("[FATAL][STREAMING] Missing OPENAI_API_KEY environment variable.");
     return new Response(JSON.stringify({ message: 'Server configuration error: Missing API Key.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

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