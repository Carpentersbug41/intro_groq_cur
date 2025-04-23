import { manageBuffer } from "./bufferUtils"; // Assuming correct import

// ... (handleAutoTransitionHidden and handleAutoTransitionVisible) ...


export async function processTransitions(
    initialHistory: ConversationEntry[],
    executedPromptIndex: number,
    promptList: PromptType[],
    initialMemory: { [key: string]: string },
    initialBufferSize: number
): Promise<{
    finalContent: string;
    history: ConversationEntry[];
    nextIndex: number;
    lastExecutedIndex: number | null; // Track the last prompt actually run
    updatedMemory: { [key: string]: string };
    updatedBufferSize: number; // Return potentially updated buffer size
}> {
    // --- Start Enhanced Debug Logs ---
    console.log("\n\n>>>> HEY! processTransitions FUNCTION STARTING <<<<");
    console.log(`>>>> [processTransitions DEBUG] Input executedPromptIndex: ${executedPromptIndex}`);
    console.log(`>>>> [processTransitions DEBUG] Input initialBufferSize: ${initialBufferSize}`);
    console.log(`>>>> [processTransitions DEBUG] Input initialHistory length: ${initialHistory.length}`);
    // --- End Enhanced Debug Logs ---

    console.log(`[DEBUG][processTransitions] Entered for executedPromptIndex: ${executedPromptIndex}`); // Keep original log too
    let currentHistory = [...initialHistory];
    let currentIndex = executedPromptIndex;
    let nextIndex = executedPromptIndex + 1; // Default next step
    let finalContent = currentHistory[currentHistory.length - 1]?.content ?? ""; // Start with the last assistant message
    let lastExecutedIndex: number | null = executedPromptIndex; // Track the last prompt that generated content
    let updatedMemory = { ...initialMemory };
    let updatedBufferSize = initialBufferSize; // Start with the initial buffer size

    const executedPromptObj = promptList[executedPromptIndex];
     console.log(`[DEBUG][processTransitions] Fetched executedPromptObj for index ${executedPromptIndex}: ${JSON.stringify(executedPromptObj)}`);


     const autoTransitionHidden = executedPromptObj?.autoTransitionHidden ?? false;
     const autoTransitionVisible = executedPromptObj?.autoTransitionVisible ?? false;

     console.log(`[DEBUG][processTransitions] Flags for executed prompt index ${executedPromptIndex}:`);
     console.log(`  - autoTransitionHidden: ${autoTransitionHidden}`);
     console.log(`  - autoTransitionVisible: ${autoTransitionVisible}`);


    if (!autoTransitionHidden && !autoTransitionVisible) {
         console.log(`[DEBUG][processTransitions] No transition flags found on executed prompt ${executedPromptIndex}. Applying workaround and returning.`);

         // --- WORKAROUND (No Transition) ---
         let historyToReturn = currentHistory.map(entry => ({ ...entry }));
         console.log(">>>> [WORKAROUND - No Transition START] Pre-processing history copy...");
         let modifiedInNoTransition = false; // Flag to see if modification happened
         for (let i = 0; i < historyToReturn.length - 1; i++) {
             const currentMsg = historyToReturn[i];
             const nextMsg = historyToReturn[i + 1];
             if (currentMsg.role === 'assistant' && currentMsg.content?.startsWith('# ') && nextMsg.role === 'user' && !nextMsg.content?.startsWith('#')) {
                  console.log(`>>>> [WORKAROUND - No Transition] Found #Asst at ${i}, prefixing User content at ${i + 1}. Original: "${nextMsg.content?.substring(0, 20)}..."`);
                  nextMsg.content = `# ${nextMsg.content}`;
                  modifiedInNoTransition = true;
             }
         }
         console.log(`>>>> [WORKAROUND - No Transition END] Finished pre-processing. Was history modified? ${modifiedInNoTransition}`);
         // --- End Workaround ---

        return {
            finalContent,
            history: historyToReturn, // Return potentially modified history
            nextIndex,
            lastExecutedIndex,
            updatedMemory,
            updatedBufferSize,
        };
    }

    // Add simulated user input for visible transitions before the loop starts
    if (autoTransitionVisible) {
        currentHistory.push({ role: 'user', content: '#OK visible transition' });
         console.log(`[DEBUG][processTransitions] Added simulated User message ("#OK visible transition") immediately after visible prompt ${executedPromptIndex}. History length: ${currentHistory.length}`);
    }


    console.log(`[DEBUG][processTransitions] Transition flag detected on prompt ${executedPromptIndex}. Proceeding to check next steps from index ${nextIndex}.`);


    // Loop through subsequent prompts as long as transition flags are set
    while (nextIndex < promptList.length) {
        console.log(`>>>> [processTransitions DEBUG] Top of transition WHILE loop. nextIndex: ${nextIndex}`); // Debug loop entry
        const nextPromptObj = promptList[nextIndex];
        if (!nextPromptObj) {
             console.log(`>>>> [processTransitions DEBUG] WARNING: No prompt object found for nextIndex ${nextIndex}. Breaking loop.`);
             break;
        }
        const nextAutoHidden = nextPromptObj?.autoTransitionHidden ?? false;
        const nextAutoVisible = nextPromptObj?.autoTransitionVisible ?? false;

        // Determine the correct transition handler
        let result;
        if (nextAutoHidden) {
             console.log(`[DEBUG][processTransitions] >>> Entering Hidden Loop - Calling handleAutoTransitionHidden for index: ${nextIndex}`);
            result = await handleAutoTransitionHidden(
                currentHistory, // Pass history
                nextIndex,
                promptList,
                updatedMemory,
                updatedBufferSize // Pass current buffer size
            );
        } else if (nextAutoVisible) {
             console.log(`[DEBUG][processTransitions] >>> Entering Visible Loop - Calling handleAutoTransitionVisible for index: ${nextIndex}`);
            result = await handleAutoTransitionVisible(
                currentHistory, // Pass history
                nextIndex,
                promptList,
                updatedMemory,
                updatedBufferSize // Pass current buffer size
            );
        } else {
             console.log(`[DEBUG][processTransitions] >>> Next prompt ${nextIndex} is NOT auto-transition. Breaking loop.`);
             break; // Exit the while loop
        }

        // Update state from the handler's result
        console.log(`>>>> [processTransitions DEBUG] Returned from handler for index ${nextIndex}. Updating state.`);
        currentHistory = result.history; // Update history from the result
        updatedMemory = result.memory; // Update memory
        finalContent = result.content; // Update final content with the latest response
        updatedBufferSize = result.bufferSize; // Update buffer size
        lastExecutedIndex = nextIndex; // Update the last index that successfully executed
        console.log(`>>>> [processTransitions DEBUG] State updated. History length: ${currentHistory.length}, Last executed: ${lastExecutedIndex}, Buffer: ${updatedBufferSize}`);


        // Add simulated user input for VISIBLE transitions within the loop
        if (nextAutoVisible) {
            currentHistory.push({ role: 'user', content: '#OK visible transition' });
            console.log(`[DEBUG][processTransitions] Added simulated User message ("#OK visible transition") after visible prompt ${nextIndex}. History length: ${currentHistory.length}`);
        }


        // Check if the *executed* prompt requires further transitions
        const executedTransitionPrompt = promptList[lastExecutedIndex];
        if (!executedTransitionPrompt?.autoTransitionHidden && !executedTransitionPrompt?.autoTransitionVisible) {
             console.log(`[DEBUG][processTransitions] Prompt ${lastExecutedIndex} executed, and it has no further transition flags. Breaking loop after this execution.`);
             nextIndex++; // Increment index for the final return value
             break; // Exit loop
        } else {
             console.log(`>>>> [processTransitions DEBUG] Prompt ${lastExecutedIndex} has transition flag. Continuing loop.`);
        }


        // Prepare for the next iteration
        nextIndex++;
    }

    console.log(`[DEBUG][processTransitions] Transition loop finished. lastExecutedIndex: ${lastExecutedIndex}, nextIndex for next turn: ${nextIndex}`);
    console.log("[DEBUG][processTransitions] Returning final result:");

    // --- WORKAROUND BEFORE FINAL RETURN ---
    let finalHistoryToReturn = currentHistory.map(entry => ({ ...entry }));
    console.log(">>>> [WORKAROUND - End Loop START] Pre-processing final history copy...");
    let modifiedInEndLoop = false; // Flag to see if modification happened
     for (let i = 0; i < finalHistoryToReturn.length - 1; i++) {
         const currentMsg = finalHistoryToReturn[i];
         const nextMsg = finalHistoryToReturn[i + 1];
         if (currentMsg.role === 'assistant' && currentMsg.content?.startsWith('# ') && nextMsg.role === 'user' && !nextMsg.content?.startsWith('#')) {
             console.log(`>>>> [WORKAROUND - End Loop] Found #Asst at ${i}, prefixing User content at ${i + 1}. Original: "${nextMsg.content?.substring(0,20)}..."`);
             nextMsg.content = `# ${nextMsg.content}`;
             modifiedInEndLoop = true;
         }
     }
    console.log(`>>>> [WORKAROUND - End Loop END] Finished pre-processing. Was history modified? ${modifiedInEndLoop}`);
     // --- End Workaround ---


    console.log(">>>> processTransitions FUNCTION ENDING <<<<\n"); // End marker

    return {
        finalContent: finalContent,
        history: finalHistoryToReturn, // Return the modified history
        nextIndex: nextIndex, // This should be the index of the prompt AFTER the last transition
        lastExecutedIndex: lastExecutedIndex, // The actual last prompt executed
        updatedMemory: updatedMemory,
        updatedBufferSize: updatedBufferSize,
    };
}

// Ensure handleAutoTransitionHidden/Visible also have detailed logs if needed
// and correctly use manageBuffer internally (though it might be stuck on Rev 5). 