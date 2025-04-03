// src/app/api/chat/chainUtils.ts

import PROMPT_LIST from "./prompts";
import { OPENAI_API_URL, DEFAULT_OPENAI_MODEL } from "./route"; // Import constants
import { fetchApiResponseWithRetry } from './openaiApiUtils';
// import { manageBuffer } from './bufferUtils'; // Assuming manageBuffer will be moved later or import from route for now
// import { injectNamedMemory } from './memoryUtils'; // Assuming injectNamedMemory will be moved later or import from route for now
// import { updateDynamicBufferMemory } from './memoryUtils'; // Assuming updateDynamicBufferMemory will be moved later or import from route for now
import { getModelForCurrentPrompt } from './promptUtils';
import { manageBuffer } from './bufferUtils';

// Define the type for conversation history entries if not already globally available
type ConversationEntry = { role: string; content: string };
type NamedMemory = { [key: string]: string };

interface ChainIfNeededParams {
    initialAssistantContent: string;
    currentHistory: ConversationEntry[];
    currentIndex: number;
    namedMemory: NamedMemory;
    currentBufferSize: number;
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
 * It iteratively calls the LLM with updated system prompts based on the PROMPT_LIST.
 *
 * @param params - Object containing initial content, history, index, memory, and buffer size.
 * @returns Object containing the final response, index, history, memory, and buffer size after chaining.
 */
export async function chainIfNeeded(params: ChainIfNeededParams): Promise<ChainIfNeededResult> {
    let { initialAssistantContent, currentHistory, currentIndex, namedMemory, currentBufferSize } = params;

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
        tempCurrentIndex < PROMPT_LIST.length &&
        PROMPT_LIST[tempCurrentIndex]?.chaining
    ) {
        const nextPromptObj = PROMPT_LIST[tempCurrentIndex];
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
        tempHistory = tempHistory.filter((entry) => entry.role !== "system");
        tempHistory.unshift({ role: "system", content: nextPromptWithMemory });
        console.log("[CHAIN DEBUG] Updated system message for chaining:\n", nextPromptWithMemory);

        // Append the *previous* assistant output (chainResponse) as a user message for this step
        tempHistory.push({ role: "user", content: chainResponse });

        // Optional: Remove duplicate assistant responses (if assistant says X and user says X next)
        // This logic might need refinement depending on exact needs
        tempHistory = tempHistory.filter((entry, index, self) => {
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
            model: getModelForCurrentPrompt(tempCurrentIndex), // Model for the prompt we are processing
            temperature: nextPromptObj?.temperature ?? 0, // Temperature for the prompt
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
            if (nextPromptObj?.saveAsNamedMemory) {
                const memoryKey = nextPromptObj.saveAsNamedMemory;
                tempNamedMemory[memoryKey] = newContent;
                console.log(`[MEMORY DEBUG][CHAIN] Index ${tempCurrentIndex}: Saved assistant output to namedMemory["${memoryKey}"]`);
            }
            // Check for user input saving (previous assistant response)
            if (nextPromptObj?.saveUserInputAsMemory) {
                const memoryKey = nextPromptObj.saveUserInputAsMemory;
                const userInputForThisStep = tempHistory[tempHistory.length - 2]?.content; // Get the 'user' message added before this step
                if (userInputForThisStep) {
                    tempNamedMemory[memoryKey] = userInputForThisStep;
                    console.log(`[MEMORY DEBUG][CHAIN] Index ${tempCurrentIndex}: Saved previous assistant output as user input to namedMemory["${memoryKey}"]`);
                }
            }
            // Update dynamic buffer based on the prompt that just finished
            // Pass tempBufferSize by reference or handle update differently if needed
            // For simplicity, let's assume updateDynamicBufferMemory can update a passed object or we update directly
            if (nextPromptObj && nextPromptObj.buffer_memory !== undefined) {
                tempBufferSize = nextPromptObj.buffer_memory;
                console.log(`[DYNAMIC BUFFER][CHAIN] Index ${tempCurrentIndex}: Updated buffer size to ${tempBufferSize}`);
            }
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

// Example temporary placeholder if bufferUtils doesn't exist yet:
// function manageBuffer(h: ConversationEntry[], size: number): ConversationEntry[] { console.warn("Using placeholder manageBuffer"); return h; }

// Example temporary placeholder if memoryUtils doesn't exist yet:
// function injectNamedMemory(text: string, mem: NamedMemory): string { console.warn("Using placeholder injectNamedMemory"); return text; }
// function updateDynamicBufferMemory(obj: any, sizeRef: { value: number }) { console.warn("Using placeholder updateDynamicBufferMemory"); }