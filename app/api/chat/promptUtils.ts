// src/app/api/chat/promptUtils.ts

import PROMPT_LIST from "./prompts"; // Adjust path if needed

// Import the constant needed by getModelForCurrentPrompt
// Option 1: Import directly from route.ts (if still exported there)
// import { DEFAULT_OPENAI_MODEL } from './route';

// Option 2 (Better): Define/Import from a central config if you create one later.
// For now, let's assume it's still exported from route.ts or define it here if preferred.
// If route.ts still exports it:
import { DEFAULT_OPENAI_MODEL } from './route';
// If you prefer to define it here (duplicate definition, less ideal):
// const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18";


/**
 * Checks if the prompt at the given index has a custom "model" property.
 * If so, returns that custom model; otherwise, returns the default model.
 */
export function getModelForCurrentPrompt(index: number): string {
    // Access imported PROMPT_LIST
    const prompt = PROMPT_LIST[index];
    console.log(`[MODEL DEBUG] Prompt at index ${index}:`, prompt ? JSON.stringify(prompt) : 'undefined'); // Safer logging
    if (prompt && (prompt as any).model) {
        const customModel = (prompt as any).model;
        console.log(`[MODEL DEBUG] Custom model found at index ${index}: ${customModel}`);
        return customModel;
    }
    // Access imported DEFAULT_OPENAI_MODEL
    console.log(`[MODEL DEBUG] No custom model at index ${index}. Using default model: ${DEFAULT_OPENAI_MODEL}`);
    return DEFAULT_OPENAI_MODEL;
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