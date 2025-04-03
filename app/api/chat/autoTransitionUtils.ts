// src/app/api/chat/autoTransitionUtils.ts

import PROMPT_LIST from "./prompts"; // Correct path relative to this new file
import { getModelForCurrentPrompt } from './promptUtils'; // Adjust path if needed
import { fetchApiResponseWithRetry } from './openaiApiUtils'; // Adjust path if needed
import { injectNamedMemory, updateDynamicBufferMemory } from './memoryUtils'; // Import memory utils
import { manageBuffer } from './bufferUtils'; // Import buffer utils
import { PromptType } from "./prompts"; // Import PromptType if needed

// Define types if not globally available
type ConversationEntry = { role: string; content: string };
type NamedMemory = { [key: string]: string };

// Interface for the return type of transition functions
interface TransitionResult {
    conversationHistory: ConversationEntry[]; // History *context* for potential next steps (not persistent state)
    response: string | null;
    updatedIndex: number;
    updatedNamedMemory: NamedMemory; // MUST return updated memory
    updatedBufferSize: number;   // MUST return updated buffer size
}

// --- insertImportantMemory remains the same ---
/**
 * Inserts an important memory entry into the conversation history.
 * It places the memory after the system prompt and any existing important memory lines.
 * NOTE: This function modifies history but is only used internally by transitions.
 * The final state management relies on returning updatedNamedMemory etc.
 */
function insertImportantMemory(conversationHistory: ConversationEntry[], content: string): ConversationEntry[] {
    // --- DEBUG START ---
    console.log(`[DEBUG][insertImportantMemory] Attempting to insert: "${content.substring(0, 50)}..."`);
    // --- DEBUG END ---
    const updatedHistory = [...conversationHistory]; // Work on a copy
    const systemIndex = updatedHistory.findIndex((msg) => msg.role === "system");
    let insertIndex = systemIndex !== -1 ? systemIndex + 1 : 0; // Insert after system or at start

    // Skip past existing important memory
    while (
        insertIndex < updatedHistory.length &&
        updatedHistory[insertIndex].role === "assistant" &&
        updatedHistory[insertIndex].content.trim().startsWith("Important_memory:")
    ) {
        insertIndex++;
    }

    updatedHistory.splice(insertIndex, 0, {
        role: "assistant", // Keep as assistant role
        content: `Important_memory: ${content}`
    });

    // --- DEBUG START ---
    console.log(`[DEBUG][insertImportantMemory] Inserted at index: ${insertIndex}. New history length: ${updatedHistory.length}`);
    // --- DEBUG END ---
    return updatedHistory;
}


/**
 * Handles the automatic transition for a single hidden prompt step.
 * Fetches the next response, updates state (memory, buffer), and returns updated state.
 */
export async function handleAutoTransitionHidden(
    baseConvHistory: ConversationEntry[], // History context from before this step
    idx: number, // The index of the prompt *triggering* this hidden transition
    currentMemory: NamedMemory, // Pass in current memory
    currentBuffer: number     // Pass in current buffer size
): Promise<TransitionResult> { // Use the defined return interface
    // --- DEBUG START ---
    console.log(`\n--- [START][AUTO-HIDDEN] ---`);
    console.log(`[DEBUG][AUTO-HIDDEN] Handler called for index: ${idx}`);
    console.log(`[DEBUG][AUTO-HIDDEN] Incoming Memory: ${JSON.stringify(currentMemory)}`);
    console.log(`[DEBUG][AUTO-HIDDEN] Incoming Buffer Size: ${currentBuffer}`);
    console.log(`[DEBUG][AUTO-HIDDEN] Incoming History Length: ${baseConvHistory.length}`);
    // --- DEBUG END ---

    // Initialize state for this step based on inputs
    let tempNamedMemory = { ...currentMemory };
    let tempBufferSize = currentBuffer;
    let tempCurrentIndex = idx; // Start at the index of the hidden prompt

    const currentPromptObj: PromptType | undefined = PROMPT_LIST[tempCurrentIndex]; // Added type hint

    if (!currentPromptObj || !currentPromptObj.autoTransitionHidden) {
        console.warn(`[WARN][AUTO-HIDDEN] Called for index ${idx} which is not autoTransitionHidden. Returning current state.`);
        console.log(`--- [END][AUTO-HIDDEN] --- (Not Applicable)\n`);
        return {
            conversationHistory: baseConvHistory,
            response: null, // No response generated for this non-step
            updatedIndex: tempCurrentIndex, // Return original index
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }

    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Confirmed: Prompt index ${idx} has autoTransitionHidden: true.`);
    // --- DEBUG END ---

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[WARNING][AUTO-HIDDEN] Missing API key.");
         console.log(`--- [END][AUTO-HIDDEN] --- (API Key Missing)\n`);
        return {
            conversationHistory: baseConvHistory,
            response: "Error: Server API Key not configured.", // More specific error
            updatedIndex: tempCurrentIndex, // Return original index
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }

    // --- Simulate User Input ("OK") and Prepare History ---
    const simulatedUserInput = "OK (hidden transition)"; // --- DEBUG VAR ---
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Simulating user input: "${simulatedUserInput}"`);
    // --- DEBUG END ---
    let historyForThisStep = [...baseConvHistory, { role: "user", content: simulatedUserInput }];
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] History length after adding simulated input: ${historyForThisStep.length}`);
    // --- DEBUG END ---

    // --- Get Prompt Text and Inject Memory ---
    const promptText = currentPromptObj.prompt_text || "Error: No prompt text found.";
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Raw Prompt Text (Index ${idx}):\n${promptText.substring(0, 150)}...`);
    // --- DEBUG END ---
    const promptWithMemory = injectNamedMemory(promptText, tempNamedMemory); // Inject memory
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Prompt Text After Memory Injection (Index ${idx}):\n${promptWithMemory.substring(0, 150)}...`);
    // --- DEBUG END ---


    // --- Update System Prompt ---
    historyForThisStep = [
        { role: "system", content: promptWithMemory },
        ...historyForThisStep.filter((e) => e.role !== "system"),
    ];
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] System prompt updated in history.`);
    // --- DEBUG END ---


    // --- Manage Buffer ---
    const bufferSizeBefore = tempBufferSize; // --- DEBUG VAR ---
    historyForThisStep = manageBuffer(historyForThisStep, tempBufferSize);
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Buffer managed. Size: ${bufferSizeBefore}. History length now: ${historyForThisStep.length}`);
     // --- DEBUG END ---

    // --- Prepare API Payload ---
    const payload = {
        model: getModelForCurrentPrompt(tempCurrentIndex),
        messages: historyForThisStep,
        temperature: currentPromptObj.temperature ?? 0,
    };
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Preparing LLM Payload for Index ${tempCurrentIndex}:`);
    console.log(`  Model: ${payload.model}`);
    console.log(`  Temperature: ${payload.temperature}`);
    console.log(`  Messages Count: ${payload.messages.length}`);
    // --- DEBUG END ---

    // --- Fetch API Response ---
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Sending request to LLM...`);
     // --- DEBUG END ---
    const autoResponse = await fetchApiResponseWithRetry(payload, 2, 500);

    if (!autoResponse) {
        console.warn(`[WARN][AUTO-HIDDEN][Index: ${tempCurrentIndex}] LLM call returned no content. Ending transition step.`);
        console.log(`--- [END][AUTO-HIDDEN] --- (LLM Error/No Content)\n`);
        // Return state *before* this failed step, but increment index as the step was attempted
        return {
            conversationHistory: historyForThisStep, // Return history *used* for the failed call
            response: null, // Indicate failure response
            updatedIndex: tempCurrentIndex + 1, // Increment index to prevent infinite loops
            updatedNamedMemory: tempNamedMemory, // Return memory state *before* this step
            updatedBufferSize: tempBufferSize,   // Return buffer size state *before* this step
        };
    }
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] LLM Response Received (Index ${tempCurrentIndex}):\n"${autoResponse.substring(0, 150)}..."`);
    // --- DEBUG END ---

    // --- Update State After Successful Response ---

    // 1. Named Memory Saving (Assistant Output)
    if (currentPromptObj.saveAsNamedMemory) {
        const memoryKey = currentPromptObj.saveAsNamedMemory;
        tempNamedMemory[memoryKey] = autoResponse;
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Saved assistant output to namedMemory["${memoryKey}"]`);
        // --- DEBUG END ---
    } else {
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] No 'saveAsNamedMemory' configured for index ${tempCurrentIndex}.`);
         // --- DEBUG END ---
    }
    // 2. Named Memory Saving (Simulated User Input)
    if (currentPromptObj.saveUserInputAsMemory) {
         const memoryKey = currentPromptObj.saveUserInputAsMemory;
         tempNamedMemory[memoryKey] = simulatedUserInput; // Save the exact simulated input
         // --- DEBUG START ---
         console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Saved simulated user input ("${simulatedUserInput}") to namedMemory["${memoryKey}"]`);
         // --- DEBUG END ---
    } else {
         // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] No 'saveUserInputAsMemory' configured for index ${tempCurrentIndex}.`);
         // --- DEBUG END ---
    }

    // 3. Update Dynamic Buffer Size
    const oldBufferSize = tempBufferSize; // --- DEBUG VAR ---
    tempBufferSize = updateDynamicBufferMemory(currentPromptObj, tempBufferSize); // Update buffer size based on the prompt just run
    // --- DEBUG START ---
    if (oldBufferSize !== tempBufferSize) {
        console.log(`[DEBUG][AUTO-HIDDEN][BUFFER] Buffer size updated from ${oldBufferSize} to ${tempBufferSize}.`);
    } else {
        console.log(`[DEBUG][AUTO-HIDDEN][BUFFER] Buffer size remains ${tempBufferSize}.`);
    }
    // --- DEBUG END ---

    // 4. Handle Important Memory (Internal history modification)
    let finalHistoryContext = [...historyForThisStep, { role: "assistant", content: autoResponse }]; // Add assistant response to context
    if (currentPromptObj.important_memory) {
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Prompt index ${tempCurrentIndex} marked as important_memory. Inserting into history context.`);
        // --- DEBUG END ---
        finalHistoryContext = insertImportantMemory(finalHistoryContext, autoResponse);
    } else {
         // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Prompt index ${tempCurrentIndex} not marked as important_memory.`);
         // --- DEBUG END ---
    }

    // 5. Increment Index for the next step/return
    const indexBeforeIncrement = tempCurrentIndex; // --- DEBUG VAR ---
    tempCurrentIndex++;
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Index incremented from ${indexBeforeIncrement} to ${tempCurrentIndex}.`);
    // --- DEBUG END ---

    // --- Return Updated State ---
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-HIDDEN] Returning updated state:`);
    console.log(`  - updatedIndex: ${tempCurrentIndex}`);
    console.log(`  - updatedNamedMemory: ${JSON.stringify(tempNamedMemory)}`);
    console.log(`  - updatedBufferSize: ${tempBufferSize}`);
    console.log(`  - response: ${autoResponse ? `"${autoResponse.substring(0,50)}..."` : 'null'}`);
    console.log(`  - conversationHistory length: ${finalHistoryContext.length}`);
    console.log(`--- [END][AUTO-HIDDEN] --- (Success)\n`);
     // --- DEBUG END ---
    return {
        conversationHistory: finalHistoryContext, // Return history *including* the response from this step
        response: autoResponse, // The response generated by this hidden step
        updatedIndex: tempCurrentIndex,
        updatedNamedMemory: tempNamedMemory,
        updatedBufferSize: tempBufferSize,
    };
}


/**
 * Handles the automatic transition for a single visible prompt step.
 */
export async function handleAutoTransitionVisible(
    baseConvHistory: ConversationEntry[], // History context from before this step
    idx: number, // The index of the prompt *triggering* this visible transition
    currentMemory: NamedMemory, // Pass in current memory
    currentBuffer: number     // Pass in current buffer size
): Promise<TransitionResult> { // Use the defined return interface
     // --- DEBUG START ---
    console.log(`\n--- [START][AUTO-VISIBLE] ---`);
    console.log(`[DEBUG][AUTO-VISIBLE] Handler called for index: ${idx}`);
    console.log(`[DEBUG][AUTO-VISIBLE] Incoming Memory: ${JSON.stringify(currentMemory)}`);
    console.log(`[DEBUG][AUTO-VISIBLE] Incoming Buffer Size: ${currentBuffer}`);
    console.log(`[DEBUG][AUTO-VISIBLE] Incoming History Length: ${baseConvHistory.length}`);
     // --- DEBUG END ---

    // Initialize state for this step
    let tempNamedMemory = { ...currentMemory };
    let tempBufferSize = currentBuffer;
    let tempCurrentIndex = idx;

    const currentPromptObj: PromptType | undefined = PROMPT_LIST[tempCurrentIndex]; // Added type hint

     if (!currentPromptObj || !currentPromptObj.autoTransitionVisible) {
        console.warn(`[WARN][AUTO-VISIBLE] Called for index ${idx} which is not autoTransitionVisible. Returning current state.`);
        console.log(`--- [END][AUTO-VISIBLE] --- (Not Applicable)\n`);
        return {
            conversationHistory: baseConvHistory,
            response: null,
            updatedIndex: tempCurrentIndex,
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Confirmed: Prompt index ${idx} has autoTransitionVisible: true.`);
    // --- DEBUG END ---


    // Check API key
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[WARNING][AUTO-VISIBLE] Missing API key.");
        console.log(`--- [END][AUTO-VISIBLE] --- (API Key Missing)\n`);
        return {
            conversationHistory: baseConvHistory,
            response: "Error: Server API Key not configured.",
            updatedIndex: tempCurrentIndex,
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }

    // --- Simulate User Input ("OK") and Prepare History ---
    const simulatedUserInput = "OK (visible transition)"; // --- DEBUG VAR ---
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Simulating user input: "${simulatedUserInput}"`);
    // --- DEBUG END ---
    let historyForThisStep = [...baseConvHistory, { role: "user", content: simulatedUserInput }];
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] History length after adding simulated input: ${historyForThisStep.length}`);
    // --- DEBUG END ---


    // --- Get Prompt Text and Inject Memory ---
    const promptText = currentPromptObj.prompt_text || "Error: No prompt text found.";
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Raw Prompt Text (Index ${idx}):\n${promptText.substring(0, 150)}...`);
    // --- DEBUG END ---
    const promptWithMemory = injectNamedMemory(promptText, tempNamedMemory);
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Prompt Text After Memory Injection (Index ${idx}):\n${promptWithMemory.substring(0, 150)}...`);
    // --- DEBUG END ---


    // --- Update System Prompt ---
    historyForThisStep = [
        { role: "system", content: promptWithMemory },
        ...historyForThisStep.filter((e) => e.role !== "system"),
    ];
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] System prompt updated in history.`);
    // --- DEBUG END ---


    // --- Manage Buffer ---
    const bufferSizeBefore = tempBufferSize; // --- DEBUG VAR ---
    historyForThisStep = manageBuffer(historyForThisStep, tempBufferSize);
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Buffer managed. Size: ${bufferSizeBefore}. History length now: ${historyForThisStep.length}`);
    // --- DEBUG END ---


    // --- Prepare API Payload ---
    const payload = {
        model: getModelForCurrentPrompt(tempCurrentIndex),
        messages: historyForThisStep,
        temperature: currentPromptObj.temperature ?? 0,
    };
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Preparing LLM Payload for Index ${tempCurrentIndex}:`);
    console.log(`  Model: ${payload.model}`);
    console.log(`  Temperature: ${payload.temperature}`);
    console.log(`  Messages Count: ${payload.messages.length}`);
    // --- DEBUG END ---


    // --- Fetch API Response ---
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Sending request to LLM...`);
    // --- DEBUG END ---
    const autoResponse = await fetchApiResponseWithRetry(payload, 2, 500);

    if (!autoResponse) {
        console.warn(`[WARN][AUTO-VISIBLE][Index: ${tempCurrentIndex}] LLM call returned no content. Ending transition step.`);
         console.log(`--- [END][AUTO-VISIBLE] --- (LLM Error/No Content)\n`);
        return {
            conversationHistory: historyForThisStep,
            response: null,
            updatedIndex: tempCurrentIndex + 1, // Increment index even on failure
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }
    // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] LLM Response Received (Index ${tempCurrentIndex}):\n"${autoResponse.substring(0, 150)}..."`);
    // --- DEBUG END ---

    // --- Update State After Successful Response ---

    // 1. Named Memory Saving (Assistant Output)
    if (currentPromptObj.saveAsNamedMemory) {
        const memoryKey = currentPromptObj.saveAsNamedMemory;
        tempNamedMemory[memoryKey] = autoResponse;
         // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] Saved assistant output to namedMemory["${memoryKey}"]`);
         // --- DEBUG END ---
    } else {
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] No 'saveAsNamedMemory' configured for index ${tempCurrentIndex}.`);
         // --- DEBUG END ---
    }
     // 2. Named Memory Saving (Simulated User Input)
    if (currentPromptObj.saveUserInputAsMemory) {
         const memoryKey = currentPromptObj.saveUserInputAsMemory;
         tempNamedMemory[memoryKey] = simulatedUserInput; // Save the exact simulated input
         // --- DEBUG START ---
         console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] Saved simulated user input ("${simulatedUserInput}") to namedMemory["${memoryKey}"]`);
         // --- DEBUG END ---
    } else {
         // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] No 'saveUserInputAsMemory' configured for index ${tempCurrentIndex}.`);
         // --- DEBUG END ---
    }

    // 3. Update Dynamic Buffer Size
    const oldBufferSize = tempBufferSize; // --- DEBUG VAR ---
    tempBufferSize = updateDynamicBufferMemory(currentPromptObj, tempBufferSize);
    // --- DEBUG START ---
    if (oldBufferSize !== tempBufferSize) {
        console.log(`[DEBUG][AUTO-VISIBLE][BUFFER] Buffer size updated from ${oldBufferSize} to ${tempBufferSize}.`);
    } else {
        console.log(`[DEBUG][AUTO-VISIBLE][BUFFER] Buffer size remains ${tempBufferSize}.`);
    }
    // --- DEBUG END ---

    // 4. Handle Important Memory (Internal history modification)
    let finalHistoryContext = [...historyForThisStep, { role: "assistant", content: autoResponse }];
    if (currentPromptObj.important_memory) {
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] Prompt index ${tempCurrentIndex} marked as important_memory. Inserting into history context.`);
        // --- DEBUG END ---
        finalHistoryContext = insertImportantMemory(finalHistoryContext, autoResponse);
    } else {
        // --- DEBUG START ---
        console.log(`[DEBUG][AUTO-VISIBLE][MEMORY] Prompt index ${tempCurrentIndex} not marked as important_memory.`);
        // --- DEBUG END ---
    }

    // 5. Increment Index
    const indexBeforeIncrement = tempCurrentIndex; // --- DEBUG VAR ---
    tempCurrentIndex++;
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Index incremented from ${indexBeforeIncrement} to ${tempCurrentIndex}.`);
     // --- DEBUG END ---


    // --- Return Updated State ---
     // --- DEBUG START ---
    console.log(`[DEBUG][AUTO-VISIBLE] Returning updated state:`);
    console.log(`  - updatedIndex: ${tempCurrentIndex}`);
    console.log(`  - updatedNamedMemory: ${JSON.stringify(tempNamedMemory)}`);
    console.log(`  - updatedBufferSize: ${tempBufferSize}`);
    console.log(`  - response: ${autoResponse ? `"${autoResponse.substring(0,50)}..."` : 'null'}`);
    console.log(`  - conversationHistory length: ${finalHistoryContext.length}`);
    console.log(`--- [END][AUTO-VISIBLE] --- (Success)\n`);
     // --- DEBUG END ---
    return {
        conversationHistory: finalHistoryContext,
        response: autoResponse,
        updatedIndex: tempCurrentIndex,
        updatedNamedMemory: tempNamedMemory,
        updatedBufferSize: tempBufferSize,
    };
}