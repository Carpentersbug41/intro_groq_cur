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
    directOutput?: string;
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
    const simulatedUserInput = "OK"; 
    let historyForThisStep = [...baseConvHistory, { role: "user", content: simulatedUserInput }];

    let autoResponseContent: string | null = null; // Variable for the response of this hidden step

    if (currentPromptObj.directOutput !== undefined && currentPromptObj.directOutput !== null) {
        // === Path for DIRECT OUTPUT in hidden transition ===
        console.log(`[DEBUG][AUTO-HIDDEN] Using DIRECT OUTPUT for index ${tempCurrentIndex}: "${currentPromptObj.directOutput}"`);
        autoResponseContent = currentPromptObj.directOutput;
    } else if (currentPromptObj.prompt_text) {
        // === Path for LLM-based hidden transition (existing logic) ===
        const promptTextWithMemory = injectNamedMemory(currentPromptObj.prompt_text, tempNamedMemory);
        let historyForHiddenLLM = [
            { role: "system", content: promptTextWithMemory },
            ...historyForThisStep.filter((e) => e.role !== "system"), // historyForThisStep was baseConvHistory + simulated "OK"
        ];
        historyForHiddenLLM = manageBuffer(historyForHiddenLLM, tempBufferSize);

        const payload = {
            model: getModelForCurrentPrompt(tempCurrentIndex, activePromptList),
            messages: historyForHiddenLLM,
            temperature: currentPromptObj.temperature ?? 0,
        };
        console.log(`\n--- START API PAYLOAD (HIDDEN LLM - Index: ${tempCurrentIndex}) ---`); // etc.
        const rawHiddenResponseFromLLM = await fetchApiResponseWithRetry(payload, 2, 500);
        autoResponseContent = cleanLlmResponse(rawHiddenResponseFromLLM);
    } else {
        console.warn(`[WARN][AUTO-HIDDEN] Prompt index ${tempCurrentIndex} for hidden transition has neither directOutput nor prompt_text.`);
        autoResponseContent = null; // Or some error indicator
    }

    if (autoResponseContent === null) {
        console.warn(`[WARN][AUTO-HIDDEN][Index: ${tempCurrentIndex}] Failed to get content for hidden step. Ending transition.`);
        return {
            conversationHistory: historyForThisStep, // historyForThisStep is the context *before* this failed hidden step's response
            response: null,
            updatedIndex: tempCurrentIndex + 1,
            updatedNamedMemory: tempNamedMemory,
            updatedBufferSize: tempBufferSize,
        };
    }

    // Common processing for autoResponseContent (direct or LLM)
    const processedHiddenResponse = processAssistantResponseMemory(
        autoResponseContent,
        currentPromptObj,
        tempNamedMemory, // Mutated
        tempCurrentIndex
    );
    
    // Named Memory Saving (Simulated User Input)
    if (currentPromptObj.saveUserInputAs) {
        const memoryKey = currentPromptObj.saveUserInputAs;
        tempNamedMemory[memoryKey] = simulatedUserInput;
    }

    // Update buffer size
    tempBufferSize = updateDynamicBufferMemory(currentPromptObj, tempBufferSize);

    let responseToReturnFromHidden = processedHiddenResponse;
    if (currentPromptObj.appendTextAfterResponse) {
        responseToReturnFromHidden += "  \n" + currentPromptObj.appendTextAfterResponse;
    }

    // Update history context: Add this hidden step's assistant response
    const finalHistoryContextAfterHidden = [
        ...historyForThisStep, // History *including* the simulated "OK" for this hidden step
        { role: "assistant", content: processedHiddenResponse } // The actual output of this hidden step
    ];

    tempCurrentIndex++;
    return {
        conversationHistory: finalHistoryContextAfterHidden,
        response: responseToReturnFromHidden,
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

    let assistantContentForVisible: string | null = null;

    if (promptObj.directOutput !== undefined && promptObj.directOutput !== null) {
        // === Path for DIRECT OUTPUT in visible transition ===
        console.log(`[DEBUG][TRANSITION-V] Using DIRECT OUTPUT for index ${currentPromptIndex}: "${promptObj.directOutput}"`);
        assistantContentForVisible = promptObj.directOutput;
    } else if (promptObj.prompt_text) {
        // === Path for LLM-based visible transition (existing logic) ===
        const updatedBufferSize = updateDynamicBufferMemory(promptObj, currentBufferSize);
        const promptTextWithMemory = injectNamedMemory(promptObj.prompt_text, currentNamedMemory);
        let historyForVisibleLLM = [
            { role: "system", content: promptTextWithMemory },
            ...conversationHistory.filter((e) => e.role !== "system"), // conversationHistory is from before this visible step
        ];
        historyForVisibleLLM = manageBuffer(historyForVisibleLLM, updatedBufferSize); // Use updatedBufferSize for this step

        const payload = {
            model: getModelForCurrentPrompt(currentPromptIndex, activePromptList),
            temperature: promptObj.temperature ?? 0,
            messages: historyForVisibleLLM
        };
        console.log(`\n--- START API PAYLOAD (VISIBLE LLM - Index: ${currentPromptIndex}) ---`); // etc.
        const rawVisibleResponseFromLLM = await fetchApiResponseWithRetry(payload);
        assistantContentForVisible = cleanLlmResponse(rawVisibleResponseFromLLM);
    } else {
        console.warn(`[WARN][TRANSITION-V] Prompt index ${currentPromptIndex} for visible transition has neither directOutput nor prompt_text.`);
        assistantContentForVisible = null;
    }

    if (assistantContentForVisible === null) {
        console.warn(`[WARN] Auto transition visible failed for index ${currentPromptIndex}. Stopping visible transitions.`);
        return {
            response: null,
            updatedIndex: currentPromptIndex + 1,
            updatedNamedMemory: currentNamedMemory,
            updatedBufferSize: currentBufferSize,
            conversationHistory // Return original history passed in
        };
    }

    let processedVisibleResponse = processAssistantResponseMemory(
        assistantContentForVisible,
        promptObj,
        currentNamedMemory, // Mutated
        currentPromptIndex
    );

    const updatedBufferSize = updateDynamicBufferMemory(promptObj, currentBufferSize);

    if (promptObj.appendTextAfterResponse) {
        processedVisibleResponse += "  \n" + promptObj.appendTextAfterResponse;
    }

    // Update history: Add this visible step's assistant response
    // The simulated user message ("#OK") is added by processTransitions *after* this handler returns and *before* the next visible step.
    const historyAfterVisibleCall = [
        ...conversationHistory, // History from *before* this visible step
        { role: "assistant", content: processedVisibleResponse }
    ];

    return {
        response: processedVisibleResponse, // This content WILL be appended to the user-facing output
        updatedIndex: currentPromptIndex + 1,
        updatedNamedMemory: currentNamedMemory,
        updatedBufferSize,
        conversationHistory: historyAfterVisibleCall
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