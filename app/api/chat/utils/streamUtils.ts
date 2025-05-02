// src/app/api/chat/streamUtils.ts

/**
 * Helper to turn a ReadableStream<Uint8Array> into an async iterable.
 */
export async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
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