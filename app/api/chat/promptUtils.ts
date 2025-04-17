// src/app/api/chat/promptUtils.ts

import { PROMPT_LIST } from "./prompts"; // <--- ENSURE THIS IMPORT IS CORRECT
import { PromptType } from "./routeTypes"; // Assuming PromptType might be here or defined locally

// Import the constant needed by getModelForCurrentPrompt
// Option 1: Import directly from route.ts (if still exported there)
// import { DEFAULT_OPENAI_MODEL } from './route';

// Option 2 (Better): Define/Import from a central config if you create one later.
// For now, let's assume it's still exported from route.ts or define it here if preferred.
// If route.ts still exports it:
// import { DEFAULT_OPENAI_MODEL } from './route';
// If you prefer to define it here (duplicate definition, less ideal):
// const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18";

// Import DEFAULT_OPENAI_MODEL from the correct source
import { DEFAULT_OPENAI_MODEL } from './openaiApiUtils';

/**
 * Checks if the prompt at the given index has a custom "model" property.
 * If so, returns that custom model; otherwise, returns the default model.
 */
export function getModelForCurrentPrompt(currentIndex: number): string {
    const promptModel = PROMPT_LIST[currentIndex]?.model;
    // console.log(`[MODEL DEBUG] Prompt at index ${currentIndex}:`, PROMPT_LIST[currentIndex]); // Log the prompt object
    // console.log(`[MODEL DEBUG] Model found for index ${currentIndex}: ${promptModel}`); // Log the specific model found
    if (!promptModel) {
        // console.log(`[MODEL DEBUG] No specific model found for index ${currentIndex}, defaulting to gpt-3.5-turbo.`);
        return "gpt-4.1-mini-2025-04-14"; // Default model
    }
    return promptModel;
}


/**
 * Checks if the prompt at the given index has a fallback property (fallbackIndex).
 * If it does, it calculates the new index by subtracting fallbackIndex (min 0).
 */
export function RollbackOnValidationFailure(currentIndex: number): number {
    // Access imported PROMPT_LIST
    const fallbackIndex = PROMPT_LIST[currentIndex]?.fallbackIndex;
    if (fallbackIndex !== undefined && typeof fallbackIndex === 'number') { // Added type check
        const newIndex = Math.max(0, currentIndex - fallbackIndex);
        console.log(
            `[ROLLBACK DEBUG] Rolling back currentIndex from ${currentIndex} by ${fallbackIndex} to ${newIndex}`
        );
        return newIndex;
    }
    console.log(
        `[ROLLBACK DEBUG] No valid fallbackIndex property found for currentIndex ${currentIndex}. No rollback applied.`
    );
    return currentIndex;
}

// Add other related utils here later if needed...