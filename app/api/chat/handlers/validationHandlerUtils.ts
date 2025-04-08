import PROMPT_LIST from "../prompts";
import { NamedMemory, saveUserInputToMemoryIfNeeded, injectNamedMemory } from '../memoryUtils';
import { HandlerResult } from "./nonStreamingHandler"; // Import common type
import { ConversationEntry } from "../route"; // Adjust if needed
import { RollbackOnValidationFailure } from '../promptUtils';
import { validateInput, generateRetryMessage } from '../openaiApiUtils';
import { SessionCookieData } from '@/lib/session';

// --- Interfaces (Moved from nonStreamingHandler.ts) ---
export interface ValidationInput { // Export if needed elsewhere, otherwise keep local
    promptIndexThatAskedLastQuestion: number | null;
    userMessage: string;
    currentNamedMemory: NamedMemory; // Mutable object passed in
    currentBufferSize: number;
    currentIndex: number;
    messagesFromClient: ConversationEntry[];
}

export type ValidationResult = // Export if needed elsewhere
    | { status: 'return_early'; data: { handlerResult: HandlerResult } }
    | { status: 'proceed'; data: { updatedNamedMemory: NamedMemory; isStorable: boolean } };

// --- Helper Function for Validation (Moved from nonStreamingHandler.ts) ---
export async function handleValidationAndPrepareState(
    input: ValidationInput
): Promise<ValidationResult> {
    const {
        promptIndexThatAskedLastQuestion,
        userMessage,
        currentNamedMemory,
        currentBufferSize,
        currentIndex,
        messagesFromClient
    } = input;

    let isStorable = true;

    if (promptIndexThatAskedLastQuestion !== null && promptIndexThatAskedLastQuestion >= 0 && promptIndexThatAskedLastQuestion < PROMPT_LIST.length) {
        const prevPromptObj = PROMPT_LIST[promptIndexThatAskedLastQuestion];
        const prevPromptValidation = prevPromptObj?.validation;
        const prevPromptValidationNeeded = typeof prevPromptValidation === 'boolean' ? prevPromptValidation : typeof prevPromptValidation === 'string';

        if (prevPromptValidationNeeded) {
            const prevPromptText = prevPromptObj?.prompt_text || "";
            const prevPromptWithMemory = injectNamedMemory(prevPromptText, currentNamedMemory);
            const customValidation = typeof prevPromptValidation === "string" ? prevPromptValidation : undefined;
            const isValid = await validateInput(userMessage, prevPromptWithMemory, customValidation);

            if (!isValid) {
                console.log(`>>> DEBUG: Validation FAILED for user input "${userMessage}" against rules of prompt index: ${promptIndexThatAskedLastQuestion}`);
                isStorable = false;

                const rolledBackIndex = RollbackOnValidationFailure(promptIndexThatAskedLastQuestion);
                console.log(`>>> DEBUG: RollbackOnValidationFailure(${promptIndexThatAskedLastQuestion}) returned: ${rolledBackIndex}`);

                let retryContent: string;
                let resultHandlerData: Partial<SessionCookieData>;

                if (rolledBackIndex !== promptIndexThatAskedLastQuestion) {
                    // ... (rollback logic)
                    const rolledBackPromptObj = PROMPT_LIST[rolledBackIndex];
                    const rolledBackPromptText = rolledBackPromptObj?.prompt_text ?? "Please try again.";
                    const rolledBackPromptWithMemory = injectNamedMemory(rolledBackPromptText, currentNamedMemory);
                    retryContent = await generateRetryMessage(userMessage, rolledBackPromptWithMemory, messagesFromClient);
                    resultHandlerData = {
                        currentIndex: rolledBackIndex + 1,
                        promptIndexThatAskedLastQuestion: rolledBackIndex,
                        namedMemory: currentNamedMemory,
                        currentBufferSize: currentBufferSize
                    };
                } else {
                    // ... (no rollback logic)
                    const failedPromptText = prevPromptObj?.prompt_text ?? "Please try that again.";
                    const failedPromptWithMemory = injectNamedMemory(failedPromptText, currentNamedMemory);
                    retryContent = await generateRetryMessage(userMessage, failedPromptWithMemory, messagesFromClient);
                    resultHandlerData = {
                        currentIndex: currentIndex,
                        promptIndexThatAskedLastQuestion: promptIndexThatAskedLastQuestion,
                        namedMemory: currentNamedMemory,
                        currentBufferSize: currentBufferSize
                    };
                }

                return {
                    status: 'return_early',
                    data: {
                        handlerResult: {
                            content: retryContent,
                            updatedSessionData: resultHandlerData
                        }
                    }
                };
            } else {
                console.log(`[INFO] Validation SUCCEEDED for user input "${userMessage}" against prompt index: ${promptIndexThatAskedLastQuestion}`);
                saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
            }
        } else {
            saveUserInputToMemoryIfNeeded(userMessage, prevPromptObj, currentNamedMemory);
        }
    } else {
        isStorable = false;
    }

    return {
        status: 'proceed',
        data: {
            updatedNamedMemory: currentNamedMemory,
            isStorable: isStorable
        }
    };
} 