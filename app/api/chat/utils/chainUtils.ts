// src/app/api/chat/utils/chainUtils.ts

// import PROMPT_LIST_RAW from "../prompts/prompts"; // Import the default export // REMOVED
import { OPENAI_API_URL, DEFAULT_OPENAI_MODEL } from "./openaiApiUtils";
import { fetchApiResponseWithRetry } from './openaiApiUtils';
import { getModelForCurrentPrompt } from './promptUtils';
import { manageBuffer } from './bufferUtils';
import { injectNamedMemory, updateDynamicBufferMemory } from './memoryUtils';
import { ConversationEntry, NamedMemory } from '../types/routeTypes';
// import { PromptType } from "../prompts/prompts"; // Remove this import

// Define a minimal local type for prompts used in this file
type LocalPromptType = {
    chaining?: boolean;
    prompt_text?: string;
    temperature?: number;
    saveAssistantOutputAs?: string;
    saveUserInputAs?: string;
    buffer_memory?: number;
    // Add other needed properties if used below
    model?: string; // Added model property for getModelForCurrentPrompt
    [key: string]: any; // Allow other properties
};

// REMOVED: Casting the imported list
// const PROMPT_LIST: LocalPromptType[] = PROMPT_LIST_RAW as LocalPromptType[];

interface ChainIfNeededParams {
    initialAssistantContent: string;
    currentHistory: ConversationEntry[];
    currentIndex: number;
    namedMemory: NamedMemory;
    currentBufferSize: number;
    activePromptList: LocalPromptType[]; // <-- ADDED activePromptList parameter
}

interface ChainIfNeededResult {
    finalResponse: string | null;
    finalIndex: number;
    finalHistory: ConversationEntry[]; // Return the history state *after* chaining for the caller to use
    updatedNamedMemory: NamedMemory;
    updatedBufferSize: number;
}

/**
 * Handles the chaining logic if the current prompt requires it.
 * It iteratively calls the LLM with updated system prompts based on the activePromptList.
 *
 * @param params - Object containing initial content, history, index, memory, buffer size, and the active prompt list.
 * @returns Object containing the final response, index, history, memory, and buffer size after chaining.
 */
export async function chainIfNeeded(params: ChainIfNeededParams): Promise<ChainIfNeededResult> {
    let { initialAssistantContent, currentHistory, currentIndex, namedMemory, currentBufferSize, activePromptList } = params;

    if (!process.env.OPENAI_API_KEY) {
        console.warn("[WARNING] Missing API key for chaining.");
        // Return original state if API key is missing
        return {
            finalResponse: "Please enter your API key.", // Or maybe return initialAssistantContent?
            finalIndex: currentIndex,
            finalHistory: currentHistory,
            updatedNamedMemory: namedMemory,
            updatedBufferSize: currentBufferSize
        };
    }

    let chainResponse = initialAssistantContent;
    // Work on a mutable copy of the history for the duration of the chaining process
    let tempHistory = JSON.parse(JSON.stringify(currentHistory));
    let tempNamedMemory = { ...namedMemory };
    let tempBufferSize = currentBufferSize;
    let tempCurrentIndex = currentIndex;

    while (
        tempCurrentIndex < activePromptList.length && // <-- Use activePromptList
        activePromptList[tempCurrentIndex]?.chaining // <-- Use activePromptList
    ) {
        const nextPromptObj: LocalPromptType | undefined = activePromptList[tempCurrentIndex]; // <-- Use activePromptList
        const nextPromptText = nextPromptObj?.prompt_text;

        if (!nextPromptText) {
            console.log("[CHAIN DEBUG] Reached end of prompts or missing prompt text during chaining.");
            break; // Exit if no next prompt text
        }

        // Inject memory into the next prompt before using it
        const nextPromptWithMemory = injectNamedMemory(nextPromptText, tempNamedMemory); // Pass memory

        // Check for duplicate system prompt *in the temp history*
        if (tempHistory[0]?.content === nextPromptWithMemory) {
            console.log("[CHAIN DEBUG] Skipping duplicate chaining prompt:\n", nextPromptWithMemory);
            tempCurrentIndex++;
            continue;
        }

        // Update system message in the temporary history
        tempHistory = tempHistory.filter((entry: ConversationEntry) => entry.role !== "system");
        tempHistory.unshift({ role: "system", content: nextPromptWithMemory });
        console.log("[CHAIN DEBUG] Updated system message for chaining:\n", nextPromptWithMemory);

        // Append the *previous* assistant output (chainResponse) as a user message for this step
        tempHistory.push({ role: "user", content: chainResponse });

        // Optional: Remove duplicate assistant responses (if assistant says X and user says X next)
        tempHistory = tempHistory.filter((entry: ConversationEntry, index: number, self: ConversationEntry[]) => {
            if (entry.role !== "assistant") return true;
            if (index < self.length - 1 && self[index + 1]?.role === "user") {
                return self[index + 1].content !== entry.content;
            }
            return true;
        });
        // console.log(
        //     "[CHAIN DEBUG] Temp history AFTER removing potential duplicates:\n",
        //     JSON.stringify(tempHistory.slice(-4), null, 2) // Log last few entries
        // );

        // Manage buffer for the temporary history *before* the API call
        tempHistory = manageBuffer(tempHistory, tempBufferSize); // Pass buffer size

        console.log(
            `[CHAIN DEBUG] Index ${tempCurrentIndex}: Payload to LLM (last 4 messages):\n`,
            JSON.stringify(tempHistory.slice(-4), null, 2)
        );

        // Prepare payload for *this* chain step
        const chainPayload = {
            // Pass activePromptList to getModelForCurrentPrompt
            model: getModelForCurrentPrompt(tempCurrentIndex, activePromptList), // <-- Pass activePromptList
            temperature: nextPromptObj?.temperature ?? 0,
            messages: tempHistory,
        };

        try {
            const apiResponse = await fetchApiResponseWithRetry(chainPayload, 2, 500); // Use retry util

            if (!apiResponse) {
                console.warn(`[CHAIN DEBUG] Index ${tempCurrentIndex}: Chaining request failed or returned no content after retries. Stopping chaining.`);
                // Exit the loop, the last successful 'chainResponse' will be returned
                break;
            }

            const newContent = apiResponse; // fetchApiResponseWithRetry returns content directly
            console.log(`[CHAIN DEBUG] Index ${tempCurrentIndex}: New content from chain:`, newContent.substring(0, 100) + "...");

            // Append the *new* assistant response to the temporary history
            tempHistory.push({ role: "assistant", content: newContent });
            chainResponse = newContent; // Update the response for the next loop or final return

            // --- State Updates for the completed prompt ---
            // Check for named memory saving for the prompt that just completed
            if (nextPromptObj?.saveAssistantOutputAs) {
                const memoryKey = nextPromptObj.saveAssistantOutputAs;
                tempNamedMemory[memoryKey] = newContent;
                console.log(`[MEMORY DEBUG][CHAIN] Index ${tempCurrentIndex}: Saved assistant output to namedMemory["${memoryKey}"]`);
            }
            // Check for user input saving (previous assistant response)
            if (nextPromptObj?.saveUserInputAs) {
                const memoryKey = nextPromptObj.saveUserInputAs;
                const userInputForThisStep = tempHistory[tempHistory.length - 2]?.content; // Get the 'user' message added before this step
                if (userInputForThisStep) {
                    tempNamedMemory[memoryKey] = userInputForThisStep;
                    console.log(`[MEMORY DEBUG][CHAIN] Index ${tempCurrentIndex}: Saved previous assistant output as user input to namedMemory["${memoryKey}"]`);
                }
            }
            // Update dynamic buffer based on the prompt that just finished
            tempBufferSize = updateDynamicBufferMemory(nextPromptObj, tempBufferSize);
            // --- End State Updates ---

            // Increment index *after* processing the current chain step
            tempCurrentIndex++;
            console.log("[CHAIN DEBUG] Incremented tempCurrentIndex to:", tempCurrentIndex);

        } catch (error: any) {
            console.error(`[ERROR][CHAIN] Index ${tempCurrentIndex}:`, error.message);
            // Exit the loop on error, the last successful 'chainResponse' will be returned
            break;
        }
    } // End while loop

    console.log("[CHAIN DEBUG] Finished chaining process.");
    console.log("[CHAIN DEBUG] Final chained response:", chainResponse ? chainResponse.substring(0, 100) + "..." : "null");
    console.log("[CHAIN DEBUG] Final index after chaining:", tempCurrentIndex);

    // Return the final state
    return {
        finalResponse: chainResponse,
        finalIndex: tempCurrentIndex,
        finalHistory: tempHistory, // Return the history state *as it was at the end of chaining*
        updatedNamedMemory: tempNamedMemory,
        updatedBufferSize: tempBufferSize
    };
}

// Placeholder/Helper: If manageBuffer, injectNamedMemory, updateDynamicBufferMemory are not yet in separate files,
// you might need temporary implementations or import them directly from route.ts initially.

// Removed placeholders as functions are now imported
// Example temporary placeholder if bufferUtils doesn't exist yet:
// function manageBuffer(h: ConversationEntry[], size: number): ConversationEntry[] { console.warn("Using placeholder manageBuffer"); return h; }

// Example temporary placeholder if memoryUtils doesn't exist yet:
// function injectNamedMemory(text: string, mem: NamedMemory): string { console.warn("Using placeholder injectNamedMemory"); return text; }
// function updateDynamicBufferMemory(obj: any, sizeRef: { value: number }) { console.warn("Using placeholder updateDynamicBufferMemory"); }