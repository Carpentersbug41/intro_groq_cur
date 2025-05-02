// src/app/api/chat/utils/autoTransitionUtils.ts

// import { PROMPT_LIST, PromptType } from "./prompts"; // No longer used directly here
import { getModelForCurrentPrompt } from './promptUtils'; // Path is correct within utils
import { fetchApiResponseWithRetry, cleanLlmResponse } from './openaiApiUtils'; // Path is correct within utils
import { injectNamedMemory, updateDynamicBufferMemory, processAssistantResponseMemory } from './memoryUtils'; // Path is correct within utils
import { manageBuffer } from './bufferUtils'; // Path is correct within utils
import { ConversationEntry } from '../types/routeTypes'; // Path corrected: Go up one level, then into types

// --- Define a minimal type for the prompt list used here --- 
// Includes properties accessed by transition logic
type TransitionPrompt = {
    prompt_text?: string;
    model?: string;
    temperature?: number;
    buffer_memory?: number;
    autoTransitionHidden?: boolean;
    autoTransitionVisible?: boolean;
    saveUserInputAs?: string;
    saveAssistantOutputAs?: string;
    appendTextAfterResponse?: string;
    important_memory?: boolean; // Keep if used by processAssistantResponseMemory
    [key: string]: any; // Allow other properties
};

// Define types if not globally available
type NamedMemory = { [key: string]: string };

// Interface for the return type of transition functions
interface TransitionResult {
    conversationHistory: ConversationEntry[];
    response: string | null;
    updatedIndex: number;
    updatedNamedMemory: NamedMemory;
    updatedBufferSize: number;
}

/**
 * Handles the automatic transition for a single hidden prompt step.
 * Fetches the next response, updates state (memory, buffer), and returns updated state.
 */
export async function handleAutoTransitionHidden(
    baseConvHistory: ConversationEntry[], // History context from before this step
    idx: number, // The index of the prompt *triggering* this hidden transition
    currentMemory: NamedMemory, // Pass in current memory
    currentBuffer: number,     // Pass in current buffer size
    activePromptList: TransitionPrompt[] // <-- ADDED: Pass the active prompt list
): Promise<TransitionResult> { // Use the defined return interface
    // --- DEBUG START ---
    // console.log(`\n--- [START][AUTO-HIDDEN] ---`); // Less verbose
    // console.log(`[DEBUG][AUTO-HIDDEN] Handler called for index: ${idx}`);
    // console.log(`[DEBUG][AUTO-HIDDEN] Incoming Memory: ${JSON.stringify(currentMemory)}`);
    // console.log(`[DEBUG][AUTO-HIDDEN] Incoming Buffer Size: ${currentBuffer}`);
    // console.log(`[DEBUG][AUTO-HIDDEN] Incoming History Length: ${baseConvHistory.length}`);
    // --- DEBUG END ---

    // Initialize state for this step based on inputs
    let tempNamedMemory = { ...currentMemory };
    let tempBufferSize = currentBuffer;
    let tempCurrentIndex = idx; // Start at the index of the hidden prompt

    const currentPromptObj: TransitionPrompt | undefined = activePromptList[tempCurrentIndex]; // <-- Use activePromptList

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

    // console.log(`[DEBUG][AUTO-HIDDEN] Confirmed: Prompt index ${idx} has autoTransitionHidden: true.`); // Less verbose

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
    const simulatedUserInput = "OK"; // --- DEBUG VAR ---
    // console.log(`[DEBUG][AUTO-HIDDEN] Simulating user input: "${simulatedUserInput}"`); // Less verbose
    let historyForThisStep = [...baseConvHistory, { role: "user", content: simulatedUserInput }];
    // console.log(`[DEBUG][AUTO-HIDDEN] History length after adding simulated input: ${historyForThisStep.length}`); // Less verbose

    // --- Get Prompt Text and Inject Memory ---
    const promptText = currentPromptObj.prompt_text || "Error: No prompt text found.";
    // console.log(`[DEBUG][AUTO-HIDDEN] Raw Prompt Text (Index ${idx}):\n${promptText.substring(0, 150)}...`);
    const promptWithMemory = injectNamedMemory(promptText, tempNamedMemory); // Inject memory
    // console.log(`[DEBUG][AUTO-HIDDEN] Prompt Text After Memory Injection (Index ${idx}):\n${promptWithMemory.substring(0, 150)}...`);


    // --- Update System Prompt ---
    historyForThisStep = [
        { role: "system", content: promptWithMemory },
        ...historyForThisStep.filter((e) => e.role !== "system"),
    ];
    // console.log(`[DEBUG][AUTO-HIDDEN] System prompt updated in history.`); // Less verbose


    // --- Manage Buffer ---
    const bufferSizeBefore = tempBufferSize; // --- DEBUG VAR ---
    historyForThisStep = manageBuffer(historyForThisStep, tempBufferSize);
     // console.log(`[DEBUG][AUTO-HIDDEN] Buffer managed. Size: ${bufferSizeBefore}. History length now: ${historyForThisStep.length}`); // Less verbose

    // --- Prepare API Payload ---
    const payload = {
        model: getModelForCurrentPrompt(tempCurrentIndex, activePromptList), // <-- Pass activePromptList
        messages: historyForThisStep,
        temperature: currentPromptObj.temperature ?? 0, // Defaults to 0
    };

    // --- UPDATED LOG ---
    console.log(`\n--- START API PAYLOAD (HIDDEN - Index: ${tempCurrentIndex}) ---`);
    console.log(JSON.stringify(payload.messages, null, 2));
    console.log(`--- END API PAYLOAD (HIDDEN - Index: ${tempCurrentIndex}) ---\n`);
    // --- END UPDATED LOG ---

    // --- Fetch API Response ---
    // console.log(`[DEBUG][AUTO-HIDDEN] Sending request to LLM...`); // Less verbose
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
    // console.log(`[DEBUG][AUTO-HIDDEN] LLM Response Received (Index ${tempCurrentIndex}):\n"${autoResponse.substring(0, 150)}..."`); // Less verbose

    // --- Update State After Successful Response ---

    // 1. Named Memory Saving (Assistant Output)
    // --- EDIT START: Use processAssistantResponseMemory for consistency ---
    // Use processAssistantResponseMemory which handles both saving and prefixing (if any)
    // It modifies tempNamedMemory directly if saveAssistantOutputAs is set.
    const processedContentForMemory = processAssistantResponseMemory(
        autoResponse, // Use the raw response here for potential prefixing checks
        currentPromptObj, // Pass the prompt object
        tempNamedMemory, // Pass the memory object (will be modified)
        tempCurrentIndex // Pass the index
    );
    // Note: processedContentForMemory might have a prefix if specified,
    // but the memory saving inside processAssistantResponseMemory should use the clean value.
    // Let's stick to using the original `autoResponse` for adding to history context below,
    // unless `important_memory` needs the prefixed version from `insertImportantMemory`.
    // --- EDIT END ---


    // 2. Named Memory Saving (Simulated User Input) - Check if still needed or handled by process... no, this is separate
    if (currentPromptObj.saveUserInputAs) { // Renamed from saveUserInputAsMemory for clarity based on PromptType
         const memoryKey = currentPromptObj.saveUserInputAs;
         tempNamedMemory[memoryKey] = simulatedUserInput; // Save the exact simulated input
         // console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Saved simulated user input ("${simulatedUserInput}") to namedMemory["${memoryKey}"]`); // Less verbose
    } else {
         // console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] No 'saveUserInputAs' configured for index ${tempCurrentIndex}.`); // Less verbose
    }


    // 3. Update Dynamic Buffer Size
    const oldBufferSize = tempBufferSize; // --- DEBUG VAR ---
    tempBufferSize = updateDynamicBufferMemory(currentPromptObj, tempBufferSize); // Update buffer size based on the prompt just run
    // console.log(`[DEBUG][AUTO-HIDDEN][BUFFER] Buffer size updated from ${oldBufferSize} to ${tempBufferSize}.`); // Less verbose
    // console.log(`[DEBUG][AUTO-HIDDEN][BUFFER] Buffer size remains ${tempBufferSize}.`); // Less verbose

    // --- New Step: Append Static Text if Configured ---
    let responseToReturn = autoResponse; // Start with the clean LLM response
    if (currentPromptObj.appendTextAfterResponse) {
      console.log(`[DEBUG][AUTO-HIDDEN] Appending static text for prompt index ${tempCurrentIndex}: "${currentPromptObj.appendTextAfterResponse}"`);
      responseToReturn += "  \n" + currentPromptObj.appendTextAfterResponse; // <-- Change \n to "  \n"
    }
    // --- End New Step ---

    // 4. Handle Important Memory (Internal history modification)
    let finalHistoryContext = [...historyForThisStep, { role: "assistant", content: autoResponse }]; // Add assistant response (clean) to context
    // if (currentPromptObj.important_memory) {
    //     // console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Prompt index ${tempCurrentIndex} marked as important_memory. Inserting into history context.`); // Less verbose
    //     // insertImportantMemory adds the "Important_memory:" prefix to the content *in the history array*.
    //     finalHistoryContext = insertImportantMemory(finalHistoryContext, autoResponse);
    // } else {
    //      // console.log(`[DEBUG][AUTO-HIDDEN][MEMORY] Prompt index ${tempCurrentIndex} not marked as important_memory.`); // Less verbose
    // }

    // 5. Increment Index for the next step/return
    const indexBeforeIncrement = tempCurrentIndex; // --- DEBUG VAR ---
    tempCurrentIndex++;
    // console.log(`[DEBUG][AUTO-HIDDEN] Index incremented from ${indexBeforeIncrement} to ${tempCurrentIndex}.`); // Less verbose

    // --- Return Updated State ---
    // console.log(`[DEBUG][AUTO-HIDDEN] Returning updated state:`); // Less verbose
    // console.log(`  - updatedIndex: ${tempCurrentIndex}`); // Less verbose
    // console.log(`  - updatedNamedMemory: ${JSON.stringify(tempNamedMemory)}`); // Less verbose
    // console.log(`  - updatedBufferSize: ${tempBufferSize}`); // Less verbose
    // console.log(`  - response: ${autoResponse ? `"${autoResponse.substring(0,50)}..."` : 'null'}`); // Less verbose
    // console.log(`  - conversationHistory length: ${finalHistoryContext.length}`); // Less verbose
    // --- EDIT START: Add detailed log of the history being returned ---
    // console.log(`[DEBUG][AUTO-HIDDEN] Content of conversationHistory being returned:`);
    // console.log(JSON.stringify(finalHistoryContext, null, 2)); // Less verbose
    // --- EDIT END ---
    // console.log(`--- [END][AUTO-HIDDEN] --- (Success)\n`); // Less verbose
    return {
        conversationHistory: finalHistoryContext, // Return history *including* the response from this step
        response: responseToReturn, // The response potentially with appended text
        updatedIndex: tempCurrentIndex,
        updatedNamedMemory: tempNamedMemory,
        updatedBufferSize: tempBufferSize,
    };
}


/**
 * Handles the automatic transition for a single visible prompt step.
 * Generates response, updates state.
 * Does NOT add simulated user message here anymore (handled by processTransitions).
 */
export async function handleAutoTransitionVisible(
    conversationHistory: ConversationEntry[],
    currentPromptIndex: number,
    currentNamedMemory: NamedMemory, // Input memory state
    currentBufferSize: number,
    activePromptList: TransitionPrompt[] // <-- ADDED: Pass the active prompt list
): Promise<{ response: string | null; updatedIndex: number; updatedNamedMemory: NamedMemory; updatedBufferSize: number; conversationHistory: ConversationEntry[] }> {
    // console.log(`[DEBUG][TRANSITION-V] Running Visible Auto Transition for index: ${currentPromptIndex}`);
    const promptObj = activePromptList[currentPromptIndex]; // <-- Use activePromptList
    if (!promptObj) {
        console.error(`[ERROR] Auto transition visible failed: Prompt object missing at index ${currentPromptIndex}`);
        // Return input memory state on error
        return { response: null, updatedIndex: currentPromptIndex + 1, updatedNamedMemory: currentNamedMemory, updatedBufferSize: currentBufferSize, conversationHistory };
    }

    const updatedBufferSize = updateDynamicBufferMemory(promptObj, currentBufferSize);
    const promptText = promptObj.prompt_text || "";
    const promptWithMemory = injectNamedMemory(promptText, currentNamedMemory);

    // --- Prepare history for THIS visible prompt's LLM call ---
    let historyForCall = [{ role: "system", content: promptWithMemory }, ...conversationHistory.filter((e) => e.role !== "system")];
    // Apply buffer *before* this visible prompt's call
    historyForCall = manageBuffer(historyForCall, updatedBufferSize); // Use updatedBufferSize for this step
    console.log(`[DEBUG][TRANSITION-V] History length BEFORE call (Index ${currentPromptIndex}): ${historyForCall.length}`);


    const payload = { model: getModelForCurrentPrompt(currentPromptIndex, activePromptList), temperature: promptObj.temperature ?? 0, messages: historyForCall }; // <-- Pass activePromptList

    // --- UPDATED LOG ---
    console.log(`\n--- START API PAYLOAD (VISIBLE - Index: ${currentPromptIndex}) ---`);
    console.log(JSON.stringify(payload.messages, null, 2));
    console.log(`--- END API PAYLOAD (VISIBLE - Index: ${currentPromptIndex}) ---\n`);
    // --- END UPDATED LOG ---

    const rawAssistantContent = await fetchApiResponseWithRetry(payload);
    const assistantContentCleaned = cleanLlmResponse(rawAssistantContent);

     if (assistantContentCleaned === null) {
        console.warn(`[WARN] Auto transition visible failed for index ${currentPromptIndex}. Stopping visible transitions.`);
        // Return input memory state on failure
        return { response: null, updatedIndex: currentPromptIndex + 1, updatedNamedMemory: currentNamedMemory, updatedBufferSize, conversationHistory: historyForCall }; // Return history used for the failed call
    }

    // --- Use processAssistantResponseMemory which handles saving output and potential '#' prefixing ---
    // It modifies currentNamedMemory directly if needed.
    let processedContentForReturn = processAssistantResponseMemory(
        assistantContentCleaned, // Pass the clean response here
        promptObj, // Pass the prompt object
        currentNamedMemory, // Pass the memory object (will be modified)
        currentPromptIndex // Pass the index
    );
    // currentNamedMemory is now potentially updated by processAssistantResponseMemory

    // --- Append Static Text if Configured ---
    if (promptObj.appendTextAfterResponse) {
        console.log(`[DEBUG][AUTO-VISIBLE] Appending static text for prompt index ${currentPromptIndex}: "${promptObj.appendTextAfterResponse}"`);
        processedContentForReturn += "  \n" + promptObj.appendTextAfterResponse;
    }

    // --- History update: Just add Assistant Response ---
    // The simulated user message is now added by processTransitions *after* this returns.
    let historyAfterCall = [
        ...historyForCall, // History used for the successful call
        { role: "assistant", content: processedContentForReturn } // Add the response generated by this visible prompt
    ];
    console.log(`[DEBUG][TRANSITION-V] Added Assistant response for index ${currentPromptIndex}. New history length: ${historyAfterCall.length}`);


    return {
        response: processedContentForReturn, // Return the content generated by this step
        updatedIndex: currentPromptIndex + 1,
        updatedNamedMemory: currentNamedMemory, // Return the potentially modified memory
        updatedBufferSize, // Return the buffer size calculated for this step
        conversationHistory: historyAfterCall // Pass history INCLUDING this step's response
    };
}

// --- NEW: Function to orchestrate transitions ---
interface ProcessTransitionsInput {
    initialHistory: ConversationEntry[];
    initialContent: string; // Content from the prompt that *triggered* the transition check
    executedPromptIndex: number; // Index of the prompt that just ran
    initialNamedMemory: NamedMemory;
    initialBufferSize: number;
    activePromptList: TransitionPrompt[]; // <-- ADDED: Pass the active prompt list
}

interface ProcessTransitionsResult {
    finalCombinedContent: string;
    nextIndexAfterProcessing: number; // Index for the *next* turn
    indexGeneratingFinalResponse: number; // Index that generated the *last* part of the content
    finalNamedMemory: NamedMemory;
    finalBufferSize: number;
    history: ConversationEntry[];
}

export async function processTransitions(
    input: ProcessTransitionsInput
): Promise<ProcessTransitionsResult> {
    const {
        initialHistory,
        initialContent, // Content from the prompt that *triggered* the transition check
        executedPromptIndex, // Index of the prompt that just ran
        initialNamedMemory,
        initialBufferSize,
        activePromptList, // <-- Destructure activePromptList
    } = input;

    // --- Start Enhanced Debug Logs ---
    console.log("\n\n>>>> HEY! processTransitions FUNCTION STARTING <<<<");
    console.log(`>>>> [processTransitions DEBUG] Input executedPromptIndex: ${executedPromptIndex}`);
    console.log(`>>>> [processTransitions DEBUG] Input initialBufferSize: ${initialBufferSize}`);
    console.log(`>>>> [processTransitions DEBUG] Input initialHistory length: ${initialHistory.length}`);
    // --- End Enhanced Debug Logs ---

    console.log(`[DEBUG][processTransitions] Entered for executedPromptIndex: ${executedPromptIndex}`); // Keep original log too

    const executedPromptObj = activePromptList[executedPromptIndex];
    // --- NEW DETAILED LOG ---
    console.log(`[DEBUG][processTransitions] Fetched executedPromptObj for index ${executedPromptIndex}:`, JSON.stringify(executedPromptObj, null, 2));
    // --- END NEW DETAILED LOG ---

    if (!executedPromptObj) {
        console.error("[ERROR] processTransitions: executedPromptObj not found at index", executedPromptIndex);
         console.log(`--- [END][processTransitions] --- (Error: Prompt Not Found)\n`);
        return {
            finalCombinedContent: initialContent, // Return original content on error
            nextIndexAfterProcessing: executedPromptIndex + 1,
            indexGeneratingFinalResponse: executedPromptIndex,
            finalNamedMemory: initialNamedMemory,
            finalBufferSize: initialBufferSize,
            history: initialHistory
        };
    }

    let currentNamedMemory = initialNamedMemory;
    let currentBufferSize = initialBufferSize;
    let historyContextForNextStep = initialHistory; // Start with history *after* the initial call
    let nextIndexAfterProcessing = executedPromptIndex + 1;
    let indexGeneratingFinalResponse = executedPromptIndex; // Start assuming the initial prompt generated the content

    const hasHiddenFlagOnExecuted = executedPromptObj.autoTransitionHidden === true;
    const hasVisibleFlagOnExecuted = executedPromptObj.autoTransitionVisible === true;

    // Initialize effectiveOutput based ONLY on trigger visibility
    let effectiveOutput = hasHiddenFlagOnExecuted ? "" : (initialContent || "");

    // --- DEBUG LOGS ---
    console.log(`[DEBUG][processTransitions] Flags for executed prompt index ${executedPromptIndex}:`);
    console.log(`  - autoTransitionHidden: ${hasHiddenFlagOnExecuted}`);
    console.log(`  - autoTransitionVisible: ${hasVisibleFlagOnExecuted}`);
    // --- END DEBUG LOGS ---

    // Only proceed if the *executed* prompt had a flag
    if (!hasHiddenFlagOnExecuted && !hasVisibleFlagOnExecuted) {
        // --- DEBUG LOG ---
        console.log(`[DEBUG][processTransitions] No transition flags found on executed prompt ${executedPromptIndex}. Returning initial state immediately.`); // Modified log
        // --- WORKAROUND REMOVED ---
        // No need to modify history here anymore
        // --- End Workaround Removal ---

        return {
            finalCombinedContent: initialContent, // Return the original content
            nextIndexAfterProcessing: executedPromptIndex + 1,
            indexGeneratingFinalResponse: executedPromptIndex,
            finalNamedMemory: initialNamedMemory,
            finalBufferSize: initialBufferSize,
            history: historyContextForNextStep
        };
    }

    // --- NEW: Define the tagged simulated message string ---
    const taggedSimulatedUserInput = "#OK"; // Start with #OK

    // --- Add simulated user message immediately if the TRIGGERING prompt was visible ---
    if (hasVisibleFlagOnExecuted) {
        historyContextForNextStep = [
            ...historyContextForNextStep,
            { role: "user", content: taggedSimulatedUserInput } // Use the tagged string
        ];
        console.log(`[DEBUG][processTransitions] Added simulated User message ("${taggedSimulatedUserInput}") immediately after visible prompt ${executedPromptIndex}. History length: ${historyContextForNextStep.length}`);
    }

    // --- DEBUG LOG ---
    console.log(`[DEBUG][processTransitions] Transition flag detected on prompt ${executedPromptIndex}. Proceeding to check next steps from index ${executedPromptIndex + 1}.`);
    // --- END DEBUG LOG ---

    let currentTransitionIndex = executedPromptIndex + 1;

    // Hidden Loop
    while (currentTransitionIndex < activePromptList.length && activePromptList[currentTransitionIndex]?.autoTransitionHidden) {
        // --- DEBUG LOG ---
        console.log(`[DEBUG][processTransitions] >>> Entering Hidden Loop - Calling handleAutoTransitionHidden for index: ${currentTransitionIndex}`);
        // --- END DEBUG LOG ---
        const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize: newBufferSize, conversationHistory: historyAfterHidden } =
            await handleAutoTransitionHidden(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize, activePromptList);
        currentTransitionIndex = updatedIndex;
        currentNamedMemory = updatedNamedMemory ?? {};
        currentBufferSize = newBufferSize;
        historyContextForNextStep = historyAfterHidden; // Use history returned by hidden handler
        indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last hidden prompt index generated this

        // --- NEW: Add simulated user message if THIS hidden step was followed by a visible one ---
        // (This is less common but handles edge cases if hidden->visible happens)
        // Note: We don't add simulated user after hidden normally, only if needed before a VISIBLE step.
        // This logic might be redundant if the main visible loop handles it, but let's keep it simple for now.
        // Simpler: The visible loop will handle adding its own "OK" before the *next* step.
    }

    // Visible Loop
    while (currentTransitionIndex < activePromptList.length && activePromptList[currentTransitionIndex]?.autoTransitionVisible) {
         // --- DEBUG LOG ---
         console.log(`[DEBUG][processTransitions] >>> Entering Visible Loop - Calling handleAutoTransitionVisible for index: ${currentTransitionIndex}`);
         // --- END DEBUG LOG ---
        const { response: autoResp, updatedIndex, updatedNamedMemory, updatedBufferSize: newBufferSize, conversationHistory: historyAfterVisible } =
            await handleAutoTransitionVisible(historyContextForNextStep, currentTransitionIndex, currentNamedMemory, currentBufferSize, activePromptList);
        currentTransitionIndex = updatedIndex;
        currentNamedMemory = updatedNamedMemory ?? {};
        currentBufferSize = newBufferSize;
        historyContextForNextStep = historyAfterVisible; // Use history returned by visible handler (includes its own assistant response)
        indexGeneratingFinalResponse = currentTransitionIndex - 1; // Last visible prompt index generated/appended this

        if (autoResp) {
            const separator = effectiveOutput ? "\n\n" : "";
            effectiveOutput += separator + autoResp; // Append visible response

            // --- UPDATED: Add TAGGED simulated user message AFTER this visible step completes ---
             historyContextForNextStep = [
                 ...historyContextForNextStep,
                 { role: "user", content: taggedSimulatedUserInput } // Use the tagged string
             ];
             console.log(`[DEBUG][processTransitions] Added simulated User message ("${taggedSimulatedUserInput}") after visible prompt ${indexGeneratingFinalResponse}. History length: ${historyContextForNextStep.length}`);
            // --- END UPDATED ---

        } else {
            console.log(`[DEBUG][processTransitions] Stopping visible transition chain due to null response at index ${currentTransitionIndex - 1}.`);
            break; // Stop if a visible transition fails or returns null
        }
    }

    // Execute the NEXT NORMAL Prompt if transitions landed on one that isn't auto
    if (nextIndexAfterProcessing < activePromptList.length) { // Check original nextIndexAfterProcessing
        const nextPromptIndexToCheck = currentTransitionIndex; // Use the index determined by the loops
        const nextNormalPromptObj = activePromptList[nextPromptIndexToCheck];
        if (nextNormalPromptObj && !nextNormalPromptObj.autoTransitionHidden && !nextNormalPromptObj.autoTransitionVisible) {
             // --- DEBUG LOG ---
             console.log(`[DEBUG][processTransitions] >>> Executing final normal prompt after transitions: Index ${nextPromptIndexToCheck}.`);
             // --- END DEBUG LOG ---
            currentBufferSize = updateDynamicBufferMemory(nextNormalPromptObj, currentBufferSize); // Update buffer for this call
            const finalPromptText = nextNormalPromptObj.prompt_text || "";
            const finalPromptWithMemory = injectNamedMemory(finalPromptText, currentNamedMemory);

            // Use the potentially updated historyContextForNextStep (which includes tagged "OK")
            let historyForFinalCall = [
                { role: "system", content: finalPromptWithMemory },
                ...historyContextForNextStep.filter((e) => e.role !== "system")
            ];
            // Apply buffer before the final normal call
            historyForFinalCall = manageBuffer(historyForFinalCall, currentBufferSize); // Pass the correct currentBufferSize

            // --- REVISED LOGGING BLOCK ---
            console.log(`\n--- START API PAYLOAD (NORMAL after Transition - Index: ${nextPromptIndexToCheck}) ---`);
            try { // Add try...catch for safety during stringify
                console.log(JSON.stringify(historyForFinalCall, null, 2)); // Log the messages array directly
            } catch (jsonError) {
                console.error("[ERROR] Failed to stringify historyForFinalCall:", jsonError);
                console.log("[DEBUG] historyForFinalCall raw object:", historyForFinalCall); // Log raw object on error
            }
            console.log(`--- END API PAYLOAD (NORMAL after Transition - Index: ${nextPromptIndexToCheck}) ---\n`);
            // --- END REVISED LOGGING BLOCK ---


            const finalPayload = { model: getModelForCurrentPrompt(nextPromptIndexToCheck, activePromptList), temperature: nextNormalPromptObj?.temperature ?? 0, messages: historyForFinalCall };
            const rawFinalAssistantContent = await fetchApiResponseWithRetry(finalPayload);
            const finalAssistantContentCleaned = cleanLlmResponse(rawFinalAssistantContent);

            if (finalAssistantContentCleaned) {
                const processedFinalContent = processAssistantResponseMemory(finalAssistantContentCleaned, nextNormalPromptObj, currentNamedMemory, nextPromptIndexToCheck);
                indexGeneratingFinalResponse = nextPromptIndexToCheck; // This final prompt generated the last part
                const separator = effectiveOutput ? "\n\n" : "";
                effectiveOutput += separator + processedFinalContent; // Append final normal prompt response
                currentTransitionIndex++; // Increment index *after* successful final prompt execution
            } else {
                 console.warn(`[WARN] Post-transition normal prompt ${nextPromptIndexToCheck} failed to generate content.`);
            }
        } else {
             // console.log(`[DEBUG][processTransitions] Next prompt ${nextPromptIndexToCheck} is auto or out of bounds. Skipping final normal execution.`);
        }
    } else {
         // console.log(`[DEBUG][processTransitions] nextIndexAfterProcessing (${currentTransitionIndex}) is out of bounds. Skipping final normal execution.`);
    }

    nextIndexAfterProcessing = currentTransitionIndex; // Set the final index for the *next* turn

    console.log(`[DEBUG][processTransitions] Transition loop finished. lastExecutedIndex: ${indexGeneratingFinalResponse}, nextIndex for next turn: ${nextIndexAfterProcessing}`);
    console.log("[DEBUG][processTransitions] Returning final result:");

    // --- WORKAROUND REMOVED ---
    // No need to modify history here anymore
    // --- End Workaround Removal ---

    console.log(">>>> processTransitions FUNCTION ENDING <<<<\n"); // End marker

    return {
        finalCombinedContent: effectiveOutput,
        nextIndexAfterProcessing,
        indexGeneratingFinalResponse,
        finalNamedMemory: currentNamedMemory,
        finalBufferSize: currentBufferSize,
        history: historyContextForNextStep // Return the history context as processed by loops/final step
    };
}