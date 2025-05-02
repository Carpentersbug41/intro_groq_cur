// src/app/api/chat/utils/bufferUtils.ts

import { ConversationEntry } from '../types/routeTypes'; // Corrected path: Go up one level, then into types

/**
 * Manages the conversation history buffer based on REVISION 7 rules:
 * Keeps:
 *   - System prompt.
 *   - Assistant messages starting with '# '.
 *   - The User message immediately following an Assistant message starting with '# '.
 *   - The 'bufferSize' most recent messages from the overall conversation.
 * Maintains original relative order.
 *
 * @param history The current conversation history.
 * @param bufferSize The number of most recent messages to keep (in addition to core priority).
 * @returns The potentially trimmed conversation history.
 */
export function manageBuffer(
    history: ConversationEntry[],
    bufferSize: number
): ConversationEntry[] {
    console.log(`[BUFFER DEBUG] Applying REVISION 7 logic (Keep System, #Asst+User pairs, ${bufferSize} most recent). Input Length: ${history.length}`);

    if (history.length <= 1) {
        console.log("[BUFFER DEBUG R7] History too short, returning as is.");
        return history;
    }

    let systemPrompt: ConversationEntry | null = null;
    let conversation: ConversationEntry[] = history;

    // Separate System Prompt if it exists
    if (history[0]?.role === 'system') {
        systemPrompt = history[0];
        conversation = history.slice(1); // Work with the rest
        console.log("[BUFFER DEBUG R7] Separated System prompt.");
    }

    if (conversation.length === 0) {
        return systemPrompt ? [systemPrompt] : [];
    }

    const corePriorityIndices = new Set<number>(); // Indices relative to the 'conversation' array
    console.log("[BUFFER DEBUG R7] Identifying Core Priority indices (#Asst + next User)...");

    // Identify Core Priority messages (#Assistant + next User)
    for (let i = 0; i < conversation.length; i++) {
        const currentMsg = conversation[i];
        const isAssistant = currentMsg.role === 'assistant';
        const content = currentMsg.content || '';
        const isImportantAssistant = isAssistant && content.startsWith('# ');

        if (isImportantAssistant) {
            corePriorityIndices.add(i);
            console.log(`[BUFFER DEBUG R7] Core Priority index ${i} (#Assistant: "${content.substring(0, 20)}...")`);
            // Also prioritize the *next* message if it's a user message AND doesn't start with #
            if (i + 1 < conversation.length && conversation[i + 1].role === 'user' && !conversation[i+1].content?.startsWith('#')) {
                corePriorityIndices.add(i + 1);
                console.log(`[BUFFER DEBUG R7] Core Priority index ${i+1} (User following #Assistant)`);
            }
        }
        // --- Removed #OK User check ---
    }
    console.log(`[BUFFER DEBUG R7] Total Core Priority indices: ${corePriorityIndices.size} -> ${JSON.stringify(Array.from(corePriorityIndices))}`);

    // Identify the N most recent message indices (relative to 'conversation' array)
    const recentIndices = new Set<number>();
    const conversationLength = conversation.length;
    const startIndex = Math.max(0, conversationLength - bufferSize); // Calculate start index for slice
    console.log(`[BUFFER DEBUG R7] Identifying ${bufferSize} most recent indices (from index ${startIndex} to ${conversationLength - 1})...`);
    for (let i = startIndex; i < conversationLength; i++) {
        recentIndices.add(i);
    }
     console.log(`[BUFFER DEBUG R7] Total Recent indices: ${recentIndices.size} -> ${JSON.stringify(Array.from(recentIndices))}`);


    // --- REVISED RECONSTRUCTION (Revision 7) ---
    // 1. Combine Core Priority and Recent indices. Set automatically handles duplicates.
    const allKeptConversationIndices = new Set([...Array.from(corePriorityIndices), ...Array.from(recentIndices)]); // Convert Sets to Arrays before spreading
    console.log(`[BUFFER DEBUG R7] Combined indices to keep (Core Priority + Recent): ${allKeptConversationIndices.size} -> ${JSON.stringify(Array.from(allKeptConversationIndices).sort((a,b) => a - b))}`); // Log sorted for readability


    // 2. Filter the 'conversation' array based on these combined indices
    const finalConversation = conversation.filter((_, index) => allKeptConversationIndices.has(index));
    console.log(`[BUFFER DEBUG R7] Filtered conversation length: ${finalConversation.length}`);

    // 3. Add system prompt back if it existed
    const finalHistory = systemPrompt ? [systemPrompt, ...finalConversation] : finalConversation;
    // --- END REVISED RECONSTRUCTION ---


    console.log(`[BUFFER DEBUG] Original length: ${history.length}, Final length: ${finalHistory.length}`);
    const numTrimmed = history.length - finalHistory.length;
    if (numTrimmed > 0) {
        console.log(`[BUFFER DEBUG] Trimmed ${numTrimmed} messages.`);
    }


    // Log snippets of final history for verification
    if (finalHistory.length > 0) {
        console.log(
            "[BUFFER DEBUG R7] Final History Content (Snippets):",
             JSON.stringify(finalHistory.map(m => ({ role: m.role, content: (m.content ?? '').substring(0, 50) + '...' })), null, 2)
        );
    }

    return finalHistory;
}