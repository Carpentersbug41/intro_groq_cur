// src/app/api/chat/bufferUtils.ts

// Define type if not globally available
type ConversationEntry = { role: string; content: string };

/**
 * Manages the conversation history buffer, trimming older messages
 * while preserving the system prompt and important memory lines.
 *
 * @param history The current conversation history.
 * @param bufferSize The maximum number of 'other' messages to keep.
 * @returns The potentially trimmed conversation history.
 */
export function manageBuffer(history: ConversationEntry[], bufferSize: number): ConversationEntry[] {
    console.log(`[BUFFER DEBUG] Input History Length: ${history.length}, Buffer Size: ${bufferSize}`);

    const systemMessage = history.find((entry) => entry.role === "system");

    // Important memory: Specific assistant messages starting with "Important_memory:"
    const importantMemoryLines = history.filter(
        (entry) =>
            entry.role === "assistant" &&
            entry.content.trim().startsWith("Important_memory:")
    );

    // Other messages: Everything else (user messages, normal assistant messages)
    const otherMessages = history.filter(
        (entry) => entry !== systemMessage && !importantMemoryLines.includes(entry)
    );

    let finalHistory = [...history]; // Start with a copy

    // Apply buffer size limit only to 'otherMessages'
    if (otherMessages.length > bufferSize) {
        const excessCount = otherMessages.length - bufferSize;
        console.log(`[BUFFER DEBUG] Trimming ${excessCount} oldest non-system, non-important messages.`);

        // Get the messages to keep (the most recent ones)
        const trimmedOtherMessages = otherMessages.slice(excessCount);

        // Reconstruct the history: system prompt first, then important memory, then trimmed other messages
        finalHistory = [
            ...(systemMessage ? [systemMessage] : []), // Keep system message if it exists
            ...importantMemoryLines,                  // Keep all important memory
            ...trimmedOtherMessages                   // Keep the buffered other messages
        ].filter(Boolean); // Filter out potential null/undefined if systemMessage was missing

        console.log(
            "[BUFFER DEBUG] Trimmed Conversation History (System + Important + Others):",
             JSON.stringify(finalHistory.map(m => ({ role: m.role, content: m.content.substring(0, 50) + '...' })), null, 2) // Log snippet
        );
    } else {
         console.log("[BUFFER DEBUG] No trimming needed.");
    }
     console.log(`[BUFFER DEBUG] Output History Length: ${finalHistory.length}`);
    return finalHistory;
}