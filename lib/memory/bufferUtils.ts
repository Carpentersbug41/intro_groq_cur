import { Message } from "ai";
import { ConversationEntry } from "@/app/api/chat/routeTypes"; // Assuming this type includes 'role' and 'content'

// REVISION 6: Keep System, #Assistant, the User msg immediately after #Assistant, #OK User; Buffer others
export function manageBuffer(
    history: ConversationEntry[],
    bufferSize: number
): ConversationEntry[] {
    console.log(">>>> HEY! AM I RUNNING REVISION 6 BUFFER LOGIC NOW???? <<<<");
    console.log(`[BUFFER DEBUG] Applying REVISION 6 logic (Keep System, #Assistant + next User, #OK User; Buffer Others). Input Length: ${history.length}, Buffer Size: ${bufferSize}`);

    if (history.length <= 1) { // Keep history if it's just the system prompt or empty
        console.log("[BUFFER DEBUG] History too short, returning as is.");
        return history;
    }

    let systemPrompt: ConversationEntry | null = null;
    let conversation: ConversationEntry[] = history;

    // Separate System Prompt if it exists
    if (history[0]?.role === 'system') {
        systemPrompt = history[0];
        conversation = history.slice(1); // Work with the rest of the conversation
        // console.log("[BUFFER DEBUG] System prompt separated.");
    } else {
        // console.log("[BUFFER DEBUG] No system prompt found.");
    }

    if (conversation.length === 0) {
        return systemPrompt ? [systemPrompt] : [];
    }

    const prioritizedIndices = new Set<number>(); // Indices within the 'conversation' array

    // Identify prioritized messages (#Assistant, #OK User, User after #Assistant)
    for (let i = 0; i < conversation.length; i++) {
        const currentMsg = conversation[i];
        const isAssistant = currentMsg.role === 'assistant';
        const isUser = currentMsg.role === 'user';
        const content = currentMsg.content || ''; // Ensure content is a string

        const isImportantAssistant = isAssistant && content.startsWith('# ');
        const isOkUser = isUser && content.startsWith('#OK ');

        if (isImportantAssistant) {
            prioritizedIndices.add(i);
            // NEW: Also prioritize the *next* message if it's a user message
            if (i + 1 < conversation.length && conversation[i + 1].role === 'user') {
                prioritizedIndices.add(i + 1);
                // console.log(`[BUFFER DEBUG] Prioritizing User index ${i + 1} (follows #Assistant index ${i})`);
            }
        } else if (isOkUser) {
            prioritizedIndices.add(i);
        }
    }

    const otherIndices: number[] = [];
    for (let i = 0; i < conversation.length; i++) {
        if (!prioritizedIndices.has(i)) {
            otherIndices.push(i);
        }
    }

    // console.log(`[BUFFER DEBUG] Prioritized indices count: ${prioritizedIndices.size}`);
    // console.log(`[BUFFER DEBUG] Other indices count: ${otherIndices.length}`);


    const availableBufferForOthers = Math.max(0, bufferSize - prioritizedIndices.size);
    // console.log(`[BUFFER DEBUG] Available buffer for 'Other' messages: ${availableBufferForOthers}`);

    const keptOtherIndices = otherIndices.slice(-availableBufferForOthers); // Keep the most recent 'other' messages

    const numTrimmed = otherIndices.length - keptOtherIndices.length;
    if (numTrimmed > 0) {
         console.log(`[BUFFER DEBUG] Trimming ${numTrimmed} oldest 'Other' messages.`);
    } else {
        console.log(`[BUFFER DEBUG] Keeping all ${otherIndices.length} 'Other' messages because count <= available buffer ${availableBufferForOthers}.`);
    }


    // Combine prioritized and kept 'other' indices
    const finalIndices = new Set([...prioritizedIndices, ...keptOtherIndices]);

    // Build the final conversation history maintaining order
    const finalConversation: ConversationEntry[] = [];
    for (let i = 0; i < conversation.length; i++) {
        if (finalIndices.has(i)) {
            finalConversation.push(conversation[i]);
        }
    }

    // Add system prompt back if it exists
    const finalHistory = systemPrompt ? [systemPrompt, ...finalConversation] : finalConversation;

    console.log(`[BUFFER DEBUG] Original length: ${history.length}, Final length: ${finalHistory.length}`);

    // Optional: Log snippets of final history for verification
    if (finalHistory.length > 0) {
        console.log("[BUFFER DEBUG] Final History Content (Snippets): [");
        finalHistory.slice(0, 5).forEach((msg, index) => { // Log first 5
             console.log(`  {`);
             console.log(`    "role": "${msg.role}",`);
             console.log(`    "content": "${(msg.content ?? '').substring(0, 50).replace(/\n/g, '\\n')}..."`);
             console.log(`  }${index < finalHistory.slice(0, 5).length - 1 ? ',' : ''}`);
        });
        if (finalHistory.length > 5) console.log("  ...");
        console.log("]");
    }


    return finalHistory;
} 