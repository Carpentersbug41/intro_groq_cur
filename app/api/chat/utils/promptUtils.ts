// src/app/api/chat/promptUtils.ts

// import { PROMPT_LIST } from "./prompts"; // No longer used directly here
// Define a type for the prompts array (adjust properties as needed)
type MinimalPrompt = { model?: string; fallbackIndex?: number; [key: string]: any };

// Import the constant needed by getModelForCurrentPrompt
import { DEFAULT_OPENAI_MODEL } from './openaiApiUtils';

/**
 * Checks if the prompt at the given index has a custom "model" property.
 * If so, returns that custom model; otherwise, returns the default model.
 */
// Modify function signature to accept the active prompt list
export function getModelForCurrentPrompt(currentIndex: number, activePromptList: MinimalPrompt[]): string {
    const promptObj = activePromptList[currentIndex];
    const promptModel = promptObj?.model;
    // console.log(`[MODEL DEBUG] Prompt at index ${currentIndex}:`, promptObj); // Log the prompt object
    // console.log(`[MODEL DEBUG] Model found for index ${currentIndex}: ${promptModel}`); // Log the specific model found
    // Return the prompt-specific model or the default
    return promptModel || DEFAULT_OPENAI_MODEL;
}


/**
 * Checks if the prompt at the given index has a fallback property (fallbackIndex).
 * If it does, it calculates the new index by subtracting fallbackIndex (min 0).
 */
// Modify function signature to accept the active prompt list
export function RollbackOnValidationFailure(currentIndex: number, activePromptList: MinimalPrompt[]): number {
    const promptObj = activePromptList[currentIndex];
    const fallbackSteps = promptObj?.fallbackIndex;
    if (fallbackSteps !== undefined && typeof fallbackSteps === 'number') {
        // Fallback is now number of steps *backwards* from the current index
        const newIndex = Math.max(0, currentIndex - fallbackSteps);
        console.log(
            `[ROLLBACK DEBUG] Fallback triggered for index ${currentIndex}. Steps: ${fallbackSteps}. Rolling back to index ${newIndex}.`
        );
        return newIndex;
    }
    console.log(
        `[ROLLBACK DEBUG] No valid fallbackIndex property found for index ${currentIndex}. No rollback applied. Returning original index ${currentIndex}.`
    );
    // Return the original index if no valid fallback is defined
    return currentIndex;
}

// Add other related utils here later if needed...