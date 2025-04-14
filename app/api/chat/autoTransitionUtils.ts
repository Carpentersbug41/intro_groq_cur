// src/app/api/chat/autoTransitionUtils.ts

import { PROMPT_LIST, PromptType } from "./prompts"; // Use named imports for both
import { getModelForCurrentPrompt } from './promptUtils'; // Adjust path if needed
import { fetchApiResponseWithRetry, cleanLlmResponse } from './openaiApiUtils'; // Adjust path if needed
import { injectNamedMemory, updateDynamicBufferMemory, processAssistantResponseMemory } from './memoryUtils'; // Import memory utils
import { manageBuffer } from './bufferUtils'; // Import buffer utils
import { ConversationEntry } from './routeTypes'; // Assuming types are defined/imported

// Define types if not globally available
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
    conversationHistory: ConversationEntry[],
    currentPromptIndex: number,
    currentNamedMemory: NamedMemory, // Input memory state
    currentBufferSize: number
): Promise<{ response: string | null; updatedIndex: number; updatedNamedMemory: NamedMemory; updatedBufferSize: number; conversationHistory: ConversationEntry[] }> {
    // console.log(`[DEBUG][TRANSITION-V] Running Visible Auto Transition for index: ${currentPromptIndex}`);
    const promptObj = PROMPT_LIST[currentPromptIndex];
    if (!promptObj) {
        console.error(`[ERROR] Auto transition visible failed: Prompt object missing at index ${currentPromptIndex}`);
        // Return input memory state on error
        return { response: null, updatedIndex: currentPromptIndex + 1, updatedNamedMemory: currentNamedMemory, updatedBufferSize: currentBufferSize, conversationHistory };
    }

    const updatedBufferSize = updateDynamicBufferMemory(promptObj, currentBufferSize);
    const promptText = promptObj.prompt_text || "";
    const promptWithMemory = injectNamedMemory(promptText, currentNamedMemory);

    let historyForCall = [{ role: "system", content: promptWithMemory }, ...conversationHistory.filter((e) => e.role !== "system")];
    historyForCall = manageBuffer(historyForCall, updatedBufferSize);

    const payload = { model: getModelForCurrentPrompt(currentPromptIndex), temperature: promptObj.temperature ?? 0, messages: historyForCall };
    const rawAssistantContent = await fetchApiResponseWithRetry(payload);
    const assistantContentCleaned = cleanLlmResponse(rawAssistantContent);

     if (assistantContentCleaned === null) {
        console.warn(`[WARN] Auto transition visible failed for index ${currentPromptIndex}. Stopping visible transitions.`);
        // Return input memory state on failure
        return { response: null, updatedIndex: currentPromptIndex + 1, updatedNamedMemory: currentNamedMemory, updatedBufferSize, conversationHistory }; // Indicate failure with null response
    }

    // --- Add saveAssistantOutputAs logic here ---
    // Use processAssistantResponseMemory which handles both saving and prefixing (if any)
    const processedContent = processAssistantResponseMemory(
        assistantContentCleaned,
        promptObj, // Pass the prompt object
        currentNamedMemory, // Pass the memory object (will be modified)
        currentPromptIndex // Pass the index
    );
    // currentNamedMemory is now potentially updated by processAssistantResponseMemory

    // --- History update and return ---
    const historyAfterCall = [...historyForCall, { role: "assistant", content: processedContent }]; // Use processed content

        return {
        response: processedContent, // Return the processed content to be appended
        updatedIndex: currentPromptIndex + 1,
        updatedNamedMemory: currentNamedMemory, // Return the potentially modified memory
        updatedBufferSize,
        conversationHistory: historyAfterCall // Pass updated history
    };
}

// --- NEW: Function to orchestrate transitions ---
interface ProcessTransitionsInput {
    initialHistory: ConversationEntry[];
    initialContent: string; // Content from the prompt that *triggered* the transition check
    executedPromptIndex: number; // Index of the prompt that just ran
    initialNamedMemory: NamedMemory;
    initialBufferSize: number;
}

interface ProcessTransitionsResult {
    finalCombinedContent: string;
    nextIndexAfterProcessing: number; // Index for the *next* turn
    indexGeneratingFinalResponse: number; // Index that generated the *last* part of the content
    finalNamedMemory: NamedMemory;
    finalBufferSize: number;
    // Optional: finalHistoryContext if needed downstream
}

export async function processTransitions(
    input: ProcessTransitionsInput
): Promise<ProcessTransitionsResult> {
    const {
        initialHistory,
        initialContent,
        executedPromptIndex,
        initialNamedMemory,
        initialBufferSize,
    } = input;

    const executedPromptObj = PROMPT_LIST[executedPromptIndex];
    if (!executedPromptObj) {
        // Should not happen if called correctly, but good practice to check
        console.error("[ERROR] processTransitions: executedPromptObj not found at index", executedPromptIndex);
        return {
            finalCombinedContent: initialContent,
            nextIndexAfterProcessing: executedPromptIndex + 1,
            indexGeneratingFinalResponse: executedPromptIndex,
            finalNamedMemory: initialNamedMemory,
            finalBufferSize: initialBufferSize,
        };
    }

    let currentNamedMemory = initialNamedMemory;
    let currentBufferSize = initialBufferSize;
    let historyContextForNextStep = initialHistory;
    let finalCombinedContent = initialContent || "";
    let nextIndexAfterProcessing = executedPromptIndex + 1;
    let indexGeneratingFinalResponse = executedPromptIndex; // Start assuming the initial prompt generated the content

    const hasHiddenFlag = executedPromptObj.autoTransitionHidden === true;
    const hasVisibleFlag = executedPromptObj.autoTransitionVisible === true;

    if (!hasHiddenFlag && !hasVisibleFlag) {
        // No transition flags on the executed prompt, return initial state
        return {
            finalCombinedContent: initialContent,
            nextIndexAfterProcessing: executedPromptIndex + 1,
            indexGeneratingFinalResponse: executedPromptIndex,
            finalNamedMemory: initialNamedMemory,
            finalBufferSize: initialBufferSize,
        };
    }

    // console.log(`\n[DEBUG][TRANSITION TRIGGER] Prompt ${executedPromptIndex} has an autoTransition flag.`);
    let currentTransitionIndex = executedPromptIndex + 1;

    if (hasHiddenFlag) {
        finalCombinedContent = ""; // Start blank if trigger was hidden
    }

    // Hidden Loop
    while (currentTransitionIndex < PROMPT_LIST.length && PROMPT_LIST[currentTransitionIndex]?.autoTransitionHidden) {
        const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize: newBufferSize, conversationHistory: historyAfterHidden } =
            await handleAutoTransitionHidden(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize);
        currentTransitionIndex = updatedIndex;
        currentNamedMemory = updatedNamedMemory ?? {};
        currentBufferSize = newBufferSize;
        historyContextForNextStep = historyAfterHidden;
        finalCombinedContent = autoResp ?? ""; // Overwrite with the last hidden response (or blank if null)
        indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last hidden prompt index generated this
    }

    // Visible Loop
    while (currentTransitionIndex < PROMPT_LIST.length && PROMPT_LIST[currentTransitionIndex]?.autoTransitionVisible) {
        const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize: newBufferSize, conversationHistory: historyAfterVisible } =
            await handleAutoTransitionVisible(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize);
        currentTransitionIndex = updatedIndex;
        currentNamedMemory = updatedNamedMemory ?? {};
        currentBufferSize = newBufferSize;
        historyContextForNextStep = historyAfterVisible;
        if (autoResp) {
            const separator = finalCombinedContent ? "\n\n" : "";
            finalCombinedContent += separator + autoResp; // Append
            indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last visible prompt index generated/appended this
    } else {
            // console.log(`[DEBUG][TRANSITION-V] Stopping visible transition chain due to null response at index ${currentTransitionIndex - 1}.`);
            break; // Stop if a visible transition fails or returns null
        }
    }

    nextIndexAfterProcessing = currentTransitionIndex; // Update index after loops

    // Execute the NEXT NORMAL Prompt if transitions landed on one that isn't auto
    if (nextIndexAfterProcessing < PROMPT_LIST.length) {
        const nextNormalPromptObj = PROMPT_LIST[nextIndexAfterProcessing];
        if (!nextNormalPromptObj?.autoTransitionHidden && !nextNormalPromptObj?.autoTransitionVisible) {
            // console.log(`[DEBUG][POST-TRANSITION] Running final normal prompt ${nextIndexAfterProcessing}.`);
            currentBufferSize = updateDynamicBufferMemory(nextNormalPromptObj, currentBufferSize); // Update buffer for this call
            const finalPromptText = nextNormalPromptObj.prompt_text || "";
            const finalPromptWithMemory = injectNamedMemory(finalPromptText, currentNamedMemory);
            let historyForFinalCall = [{ role: "system", content: finalPromptWithMemory }, ...historyContextForNextStep.filter((e) => e.role !== "system")];
            historyForFinalCall = manageBuffer(historyForFinalCall, currentBufferSize);

            const finalPayload = { model: getModelForCurrentPrompt(nextIndexAfterProcessing), temperature: nextNormalPromptObj?.temperature ?? 0, messages: historyForFinalCall };
            const rawFinalAssistantContent = await fetchApiResponseWithRetry(finalPayload);
            const finalAssistantContentCleaned = cleanLlmResponse(rawFinalAssistantContent);

            if (finalAssistantContentCleaned) {
                const processedFinalContent = processAssistantResponseMemory(finalAssistantContentCleaned, nextNormalPromptObj, currentNamedMemory, nextIndexAfterProcessing);
                const separator = finalCombinedContent ? "\n\n" : "";
                finalCombinedContent += separator + processedFinalContent; // Append final normal prompt response
                indexGeneratingFinalResponse = nextIndexAfterProcessing; // This final prompt generated the last part
                nextIndexAfterProcessing++; // Increment index *after* successful final prompt execution
                // Note: historyContextForNextStep doesn't include this *very last* response unless needed downstream
            } else {
                 console.warn(`[WARN] Post-transition normal prompt ${nextIndexAfterProcessing} failed to generate content.`);
                 // Decide how to proceed: return content generated so far, or an error?
                 // Current behaviour: Return content generated up to this point. Index remains pointing *at* the failed prompt.
            }
        }
    }

    return {
        finalCombinedContent,
        nextIndexAfterProcessing,
        indexGeneratingFinalResponse,
        finalNamedMemory: currentNamedMemory,
        finalBufferSize: currentBufferSize,
    };
}