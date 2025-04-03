// src/app/api/chat/autoTransitionUtils.ts

import PROMPT_LIST from "./prompts"; // Correct path relative to this new file
import { getModelForCurrentPrompt } from './promptUtils'; // Adjust path if needed
import { fetchApiResponseWithRetry } from './openaiApiUtils'; // Adjust path if needed

// Define the type for conversation history entries if not already globally available
// If you have a central types file, import it instead.
type ConversationEntry = { role: string; content: string };

// --- Moved Functions ---

/**
 * Inserts an important memory entry into the conversation history.
 * It places the memory after the system prompt and any existing important memory lines.
 */
function insertImportantMemory(conversationHistory: ConversationEntry[], content: string): ConversationEntry[] {
    const updatedHistory = [...conversationHistory]; // Work on a copy
    const systemIndex = updatedHistory.findIndex((msg) => msg.role === "system");
    let insertIndex = systemIndex + 1;

    // Ensure important memory lines are stored in order
    while (
        insertIndex < updatedHistory.length &&
        updatedHistory[insertIndex].role === "assistant" &&
        updatedHistory[insertIndex].content.trim().startsWith("Important_memory:")
    ) {
        insertIndex++;
    }

    // Insert the important memory entry
    updatedHistory.splice(insertIndex, 0, {
        role: "assistant",
        content: `Important_memory: ${content}`
    });

    console.log("[DEBUG] Important_memory inserted at index:", insertIndex);
    return updatedHistory; // Return the modified history
}


/**
 * Handles the automatic transition to the next prompt when the current prompt
 * has `autoTransitionHidden` set to true. Fetches the next response without user input.
 */
export async function handleAutoTransitionHidden(
    convHistory: ConversationEntry[],
    idx: number
): Promise<{
    conversationHistory: ConversationEntry[];
    response: string | null;
    updatedIndex: number;
}> {
    console.log("[AUTO-HIDDEN] Starting auto-transition hidden process...");
    // DEBUG ADDED: Log current index and prompt details for hidden auto-transition.
    console.log("[DEBUG - AUTO-HIDDEN] At currentIndex:", idx, "Prompt details:", JSON.stringify(PROMPT_LIST[idx]));

    // Check if the API key is available
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[WARNING] Missing API key. Prompting user for input.");
        return {
            conversationHistory: convHistory,
            response: "Please enter your GROQ API key.",
            updatedIndex: idx,
        };
    }

    // Append a silent acknowledgment from the user (won't be shown)
    let currentConvHistory = [...convHistory, { role: "user", content: "OK" }];
    console.log("[AUTO-HIDDEN] user 'OK' appended, but it won’t be shown to the user.");
    console.log("[DEBUG - AUTO-HIDDEN] conversationHistory after appending OK:", JSON.stringify(currentConvHistory, null, 2));

    let currentIdx = idx + 1;
    const nextPromptObj = PROMPT_LIST[currentIdx];
    const nextPrompt = nextPromptObj?.prompt_text || "No further prompts.";
    console.log("[AUTO-HIDDEN] Next prompt text:", nextPrompt);

    // Update system message
    currentConvHistory = [
        { role: "system", content: nextPrompt },
        ...currentConvHistory.filter((e) => e.role !== "system"),
    ];

    // Construct API request payload
    const payload = {
        model: getModelForCurrentPrompt(currentIdx),
        messages: currentConvHistory,
        // Add temperature if needed based on prompt object
        temperature: nextPromptObj?.temperature ?? 0,
    };

    // Fetch API response with retry logic
    const autoResponse = await fetchApiResponseWithRetry(payload, 2, 500);

    if (!autoResponse) {
        console.warn("[AUTO-HIDDEN] Second LLM call returned no content.");
        // Return history up to this point, but no new response content
        return { conversationHistory: currentConvHistory, response: null, updatedIndex: currentIdx };
    }

    // Append assistant's response
    currentConvHistory.push({ role: "assistant", content: autoResponse });

    // Check if the prompt requires memory retention
    console.log(
        "[AUTO-HIDDEN DEBUG] Checking if this prompt requires important memory:",
        nextPromptObj?.important_memory
    );

    if (nextPromptObj?.important_memory) {
        console.log("[AUTO-HIDDEN DEBUG] This prompt is marked as important. Inserting into memory.");
        currentConvHistory = insertImportantMemory(currentConvHistory, autoResponse); // Store important response in memory
        console.log("[DEBUG] Important memory successfully inserted for this transition.");
    }

    return { conversationHistory: currentConvHistory, response: autoResponse, updatedIndex: currentIdx };
}


/**
 * Handles the automatic transition to the next prompt when the current prompt
 * has `autoTransitionVisible` set to true. Fetches the next response after adding a visible "OK".
 */
export async function handleAutoTransitionVisible(
    convHistory: ConversationEntry[],
    idx: number
): Promise<{
    conversationHistory: ConversationEntry[];
    response: string | null;
    updatedIndex: number;
}> {
    console.log("[AUTO-VISIBLE] Starting auto-transition visible process...");

    // Ensure API key exists before making a request
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[WARNING] Missing API key. Request cannot proceed.");
        return {
            conversationHistory: convHistory,
            response: "Please enter your Groq API Key to continue.",
            updatedIndex: idx,
        };
    }

    // Append user confirmation (visible transition)
    let currentConvHistory = [...convHistory, { role: "user", content: "OK" }];
    console.log("[AUTO-VISIBLE] User 'OK' appended (visible).");

    // Move to the next prompt
    let currentIdx = idx + 1;
    const nextPromptObj = PROMPT_LIST[currentIdx];
    const nextPrompt = nextPromptObj?.prompt_text || "No further prompts.";
    console.log("[AUTO-VISIBLE] Next prompt text:", nextPrompt);

    console.log("[DEBUG - AUTO-VISIBLE] conversationHistory after appending OK:", JSON.stringify(currentConvHistory, null, 2));

    // Update conversation history with new system prompt
    currentConvHistory = [
        { role: "system", content: nextPrompt },
        ...currentConvHistory.filter((e) => e.role !== "system"),
    ];

    // Prepare payload for the API request
    const payload = {
        model: getModelForCurrentPrompt(currentIdx),
        messages: currentConvHistory,
        // Add temperature if needed based on prompt object
        temperature: nextPromptObj?.temperature ?? 0,
    };

    // Fetch API response with retry logic
    const autoResponse = await fetchApiResponseWithRetry(payload, 2, 500);

    // Handle cases where the API fails to return content
    if (!autoResponse) {
        console.warn("[AUTO-VISIBLE] Second LLM call returned no content.");
        // Return history up to this point, but no new response content
        return { conversationHistory: currentConvHistory, response: null, updatedIndex: currentIdx };
    }

    // Append assistant response to the conversation
    currentConvHistory.push({ role: "assistant", content: autoResponse });

    // Check for important memory
    console.log(
        "[AUTO-VISIBLE DEBUG] Checking if this prompt requires important memory:",
        nextPromptObj?.important_memory
    );

    if (nextPromptObj?.important_memory) {
        console.log("[AUTO-VISIBLE DEBUG] This prompt is marked as important. Inserting into memory.");
        // Insert important memory
        currentConvHistory = insertImportantMemory(currentConvHistory, autoResponse);
        console.log("[DEBUG] Important_memory successfully inserted for this transition.");
    }

    return { conversationHistory: currentConvHistory, response: autoResponse, updatedIndex: currentIdx };
}