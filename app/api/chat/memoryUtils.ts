// src/app/api/chat/memoryUtils.ts

// --- Types ---
type NamedMemory = { [key: string]: string };
// Define a simple type for the prompt configuration object used in these functions
// Add other relevant properties from your PROMPT_LIST items if needed for future memory logic
type PromptConfig = {
    //saveUserInputAsMemory?: string; // Remove potential typo key
    //saveAsNamedMemory?: string; // Remove old combined key
    saveUserInputAs?: string; // Keep: Key for user input
    saveAssistantOutputAs?: string; // Keep: Key for assistant output
    important_memory?: boolean; // <-- RE-ADDED
    buffer_memory?: number | string;
    // Add other potential prompt config properties if they become relevant here
    [key: string]: any; // Allow other properties
};

// --- Existing Functions ---

/**
 * injectNamedMemory: Replaces placeholders like {key} in the prompt text
 * with corresponding values found in the provided namedMemory object.
 * If a key is not found in namedMemory, the placeholder is replaced with an empty string.
 *
 * @param {string} promptText - The text containing potential placeholders (e.g., "User answer was {answerquestion}").
 * @param {NamedMemory | null | undefined} namedMemory - The object holding the key-value pairs for injection. Handles null/undefined gracefully.
 * @returns {string} The prompt text with all recognized placeholders replaced.
 */
export function injectNamedMemory(promptText: string, namedMemory: NamedMemory | null | undefined): string {
    // console.log("[MEMORY DEBUG] Original prompt text before injection:", promptText ? promptText.substring(0, 100) + "..." : "[EMPTY]"); // Less verbose

    // Return immediately if the input prompt text is empty or nullish
    if (!promptText) {
        return promptText || ""; // Return empty string if promptText is null/undefined
    }

    // Handle cases where namedMemory might not be provided (e.g., initial state)
    if (!namedMemory) {
        console.warn("[MEMORY DEBUG] namedMemory object was null or undefined during injection. Replacing placeholders with empty strings.");
        // Define the regex to find placeholders: {key}
        const placeholderRegex = /{([^}]+)}/g;
        // Replace all placeholders found with empty strings since no memory is available
        return promptText.replace(placeholderRegex, (match, p1) => {
             const memoryKey = p1.trim();
             console.warn(`[MEMORY DEBUG] No namedMemory object available for key: ${memoryKey}. Inserting empty string.`);
             return ""; // Insert empty string for the placeholder
        });
    }

    // Define the regex to find placeholders: {key}
    const placeholderRegex = /{([^}]+)}/g;

    // Replace each placeholder found in the prompt text
    const newText = promptText.replace(placeholderRegex, (match, p1) => {
        // Extract the key from the placeholder (e.g., "answerquestion" from "{answerquestion}")
        const memoryKey = p1.trim();
        // console.log(`[MEMORY DEBUG] Found placeholder: {${memoryKey}}`); // Less verbose

        // Check if the key exists as a property in the namedMemory object
        // Using Object.prototype.hasOwnProperty.call is safer than a direct check (namedMemory[memoryKey])
        // against potential prototype pollution or inherited properties.
        // Also check if the value is not null or undefined.
        if (Object.prototype.hasOwnProperty.call(namedMemory, memoryKey) && namedMemory[memoryKey] != null) {
            // console.log(`[MEMORY DEBUG] Injecting named memory for key: ${memoryKey}`); // Less verbose
            // If the key exists and has a value, inject it
            // Ensure the injected value is returned as a string
            return String(namedMemory[memoryKey]);
        } else {
            // console.warn(`[MEMORY DEBUG] No value found in namedMemory for key: ${memoryKey}. Inserting empty string.`); // Keep Warning
            return ""; // Insert empty string for the placeholder
        }
    });

    // console.log("[MEMORY DEBUG] Final prompt text after injection:", newText ? newText.substring(0, 100) + "..." : "[EMPTY]"); // Less verbose
    return newText; // Return the processed text
}


/**
 * updateDynamicBufferMemory: Calculates the new buffer size based on the prompt object's
 * 'buffer_memory' property, if it exists. Otherwise, returns the current buffer size.
 *
 * @param {PromptConfig | undefined | null} promptObj - The prompt configuration object which might contain a 'buffer_memory' key.
 * @param {number} currentBufferSize - The current buffer size before checking the prompt object.
 * @returns {number} The new buffer size if specified in the promptObj, otherwise the currentBufferSize.
 */
export function updateDynamicBufferMemory(promptObj: PromptConfig | undefined | null, currentBufferSize: number): number {
    // Check if the prompt object exists and has a 'buffer_memory' property defined
    // Using '!= null' checks for both 'undefined' and 'null'
    if (promptObj && promptObj.buffer_memory != null) {
        // Attempt to parse the value as an integer.
        const newSize = parseInt(String(promptObj.buffer_memory), 10);

        // Validate if the parsed value is a non-negative integer.
        if (!isNaN(newSize) && Number.isInteger(newSize) && newSize >= 0) {
             // Check if the new size is different from the current size before logging/returning
             if (newSize !== currentBufferSize) {
                 console.log(`[DYNAMIC BUFFER] Updated buffer size from ${currentBufferSize} to ${newSize} based on prompt definition.`);
                 return newSize; // Return the new valid size
             } else {
                 // Log that the size is specified but matches the current one.
                 console.log(`[DYNAMIC BUFFER] Prompt specifies buffer size ${newSize}, which matches the current size. No change.`);
                 return currentBufferSize; // Return the unchanged current size
             }
        } else {
            // Log a warning if the value is invalid (not a non-negative integer).
            console.warn(`[DYNAMIC BUFFER] Invalid 'buffer_memory' value found in prompt: '${promptObj.buffer_memory}'. Using current buffer size: ${currentBufferSize}`);
            return currentBufferSize; // Return the unchanged current size due to invalid input
        }
    } else {
        // Log if no specific buffer size is mentioned in the prompt object.
        // console.log(`[DYNAMIC BUFFER] No 'buffer_memory' override in prompt. Using current buffer size: ${currentBufferSize}`); // Optional: reduce log noise
        return currentBufferSize; // Return the unchanged current size
    }
}

// --- NEW Functions ---

/**
 * saveUserInputToMemoryIfNeeded: Saves the user's message content to named memory
 * if the current prompt configuration specifies it.
 *
 * @param {string} userMessage - The content of the user's message.
 * @param {PromptConfig | undefined | null} promptConfig - The configuration object for the current prompt.
 * @param {NamedMemory} currentNamedMemory - The mutable named memory object. **This object will be modified directly.**
 * @returns {void} - Returns nothing as it modifies the object directly.
 */
export function saveUserInputToMemoryIfNeeded(
    userMessage: string,
    promptConfig: PromptConfig | undefined | null,
    currentNamedMemory: NamedMemory
): void {
    if (!promptConfig) return; // Safety check

    // Check the correct key: saveUserInputAs
    if (promptConfig.saveUserInputAs) {
        const memoryKey = promptConfig.saveUserInputAs;
        // No need for existence check on currentNamedMemory if it's guaranteed to be an object beforehand
        currentNamedMemory[memoryKey] = userMessage;
        // console.log(`[MEMORY DEBUG] Saved user input to namedMemory["${memoryKey}"]`); // Less verbose
    } else {
        // console.log(`[MEMORY DEBUG] No saveUserInputAs configured for this prompt.`); // Less verbose
    }
}

/**
 * processAssistantResponseMemory: Handles saving the assistant's response to named memory
 * and prefixing it for "important memory" based on the prompt configuration.
 *
 * @param {string} assistantContent - The cleaned response content from the assistant.
 * @param {PromptConfig | undefined | null} promptConfig - The configuration object for the prompt that generated the response.
 * @param {NamedMemory} currentNamedMemory - The mutable named memory object. **This object will be modified directly.**
 * @param {number} promptIndex - The index of the prompt that ran (for logging).
 * @returns {string} - The potentially prefixed assistant content.
 */
export function processAssistantResponseMemory(
    assistantContent: string,
    promptConfig: PromptConfig | undefined | null,
    currentNamedMemory: NamedMemory,
    promptIndex: number // Added for logging context
): string {
    if (!promptConfig) {
         console.warn(`[MEMORY DEBUG] processAssistantResponseMemory called with no promptConfig for index ${promptIndex}. Skipping memory operations.`);
         return assistantContent; // Return original content if no config
    }

    let finalContent = assistantContent; // Start with the original content

    // 1. Save assistant output to named memory if configured
    // Check the correct key: saveAssistantOutputAs
    if (promptConfig.saveAssistantOutputAs) {
        const memoryKey = promptConfig.saveAssistantOutputAs;
        // console.log(`>>> [MEMORY DEBUG] Before saving assistant output for key "${memoryKey}" (index ${promptIndex}): typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`); // Less verbose
        // No need for existence check on currentNamedMemory if guaranteed to be object
        currentNamedMemory[memoryKey] = assistantContent; // Save the *original* non-prefixed content
        // console.log(`[MEMORY DEBUG] Saved assistant output to namedMemory["${memoryKey}"] = "${currentNamedMemory[memoryKey]}"`); // Less verbose
        // console.log(`>>> [MEMORY DEBUG] After saving assistant output (index ${promptIndex}): typeof currentNamedMemory = ${typeof currentNamedMemory}, Value = ${JSON.stringify(currentNamedMemory)}`); // Less verbose
    } else {
        // console.log(`[MEMORY DEBUG] No saveAssistantOutputAs configured for prompt index ${promptIndex}.`); // Less verbose
    }

    // 2. Prefix for important memory if configured
    if (promptConfig.important_memory) {
        console.log(`[IMPORTANT MEMORY] Prompt index ${promptIndex} requires important memory. Prepending '#' prefix.`);
        finalContent = `# ${assistantContent}`; // Prepend '#' and a space to the content being returned/used further
    } else {
        // console.log(`[IMPORTANT MEMORY] Prompt index ${promptIndex} does not require important memory prefix.`); // Less verbose
        // finalContent remains the original assistantContent
    }

    return finalContent; // Return the content (potentially prefixed)
}


// --- Exports ---
export type { NamedMemory, PromptConfig };