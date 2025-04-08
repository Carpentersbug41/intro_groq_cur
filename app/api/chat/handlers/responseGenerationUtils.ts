import PROMPT_LIST from "../prompts";
import { NamedMemory, processAssistantResponseMemory, insertImportantMemory } from '../memoryUtils'; // Import needed memory utils
import { HandlerResult } from "./nonStreamingHandler"; // Import common type
import { ConversationEntry } from "../route"; // Assuming type defined here, adjust if needed
import { getModelForCurrentPrompt } from '../promptUtils';
import { updateDynamicBufferMemory } from '../memoryUtils';
import { manageBuffer } from '../bufferUtils';
import { fetchApiResponseWithRetry, cleanLlmResponse } from '../openaiApiUtils';
import { SessionCookieData } from '@/lib/session'; // Needed for error return type

// --- Interfaces (Moved from nonStreamingHandler.ts) ---
interface GenerateMainResponseInput {
    currentIndex: number;
    currentHistory: ConversationEntry[];
    currentNamedMemory: NamedMemory; // Mutable
    currentBufferSize: number; // Mutable
}

type GenerateMainResponseResult =
    | { status: 'success'; data: { initialResponseContent: string; historyAfterLLM: ConversationEntry[]; updatedNamedMemory: NamedMemory; updatedBufferSize: number } }
    | { status: 'error'; data: { handlerResult: HandlerResult } };


// --- Helper Function for Core Response Generation (Moved from nonStreamingHandler.ts) ---
export async function generateMainResponse(
    input: GenerateMainResponseInput
): Promise<GenerateMainResponseResult> {
    let { currentIndex, currentHistory, currentNamedMemory, currentBufferSize } = input;

    // Determine promptIndexThatAskedLastQuestion robustly if needed for error state
    // This simplistic guess might be insufficient. Consider passing it if the error state absolutely needs it.
    const promptIndexThatAskedLastQuestion = sessionData.promptIndexThatAskedLastQuestion; // <-- This needs the actual sessionData passed in input if required

    console.log(`Attempting to access PROMPT_LIST at index: ${currentIndex}`);
    try {
        const currentPromptObj = PROMPT_LIST[currentIndex];
        if (!currentPromptObj) {
            console.error("[ERROR] Current prompt object is missing at index:", currentIndex);
            return {
                status: 'error',
                data: {
                    handlerResult: { content: "Internal error: Could not retrieve current prompt details.", updatedSessionData: null }
                }
            };
        }
        console.log('Successfully accessed prompt:', currentPromptObj);

        const currentPromptText = currentPromptObj.prompt_text || "";
        const currentPromptWithMemory = injectNamedMemory(currentPromptText, currentNamedMemory); // injectNamedMemory needs import from memoryUtils

        currentBufferSize = updateDynamicBufferMemory(currentPromptObj, currentBufferSize);

        let historyForLLM = [
            { role: "system", content: currentPromptWithMemory },
            ...currentHistory.filter((entry) => entry.role !== "system"),
        ];
        historyForLLM = manageBuffer(historyForLLM, currentBufferSize);

        const mainPayload = {
            model: getModelForCurrentPrompt(currentIndex),
            temperature: currentPromptObj?.temperature ?? 0,
            messages: historyForLLM,
        };
        const rawAssistantContent = await fetchApiResponseWithRetry(mainPayload);
        const assistantContentCleaned = cleanLlmResponse(rawAssistantContent);

        if (!assistantContentCleaned) {
            console.error("[ERROR] Main LLM call failed for index:", currentIndex);
            return {
                status: 'error',
                data: {
                    handlerResult: {
                        content: "I'm sorry, I couldn't process that. Could you repeat?",
                        updatedSessionData: {
                            currentIndex: currentIndex,
                            promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion,
                            namedMemory: currentNamedMemory,
                            currentBufferSize: currentBufferSize
                        }
                    }
                }
            };
        }

        let initialResponseContent = processAssistantResponseMemory(
            assistantContentCleaned,
            currentPromptObj,
            currentNamedMemory,
            currentIndex
        );

        let historyAfterLLM = [
            ...historyForLLM,
            { role: "assistant", content: initialResponseContent }
        ];
        if (currentPromptObj.important_memory) {
            historyAfterLLM = insertImportantMemory(historyAfterLLM, initialResponseContent); // Uses imported function
        }

        return {
            status: 'success',
            data: {
                initialResponseContent,
                historyAfterLLM,
                updatedNamedMemory: currentNamedMemory,
                updatedBufferSize: currentBufferSize
            }
        };

    } catch (error: any) {
        console.error("[JEST_DEBUG] ERROR CAUGHT within generateMainResponse:", error);
        return {
            status: 'error',
            data: {
                handlerResult: {
                    content: "An internal server error occurred while generating the response.",
                    updatedSessionData: null
                }
            }
        };
    }
}

// Need to import injectNamedMemory if it's not already here
import { injectNamedMemory } from '../memoryUtils'; 