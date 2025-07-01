import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';
import mustache from 'mustache';

export const saveToImportantMemoryHandler = {
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string) => console.log(`[req:${requestId}][SAVE_TO_IMPORTANT_MEMORY] ${message}`);

    if (!step.value_to_save || !step.save_to_memory_key) {
        throw new Error("SAVE_TO_IMPORTANT_MEMORY requires 'value_to_save' and 'save_to_memory_key'");
    }

    const contentToSave = mustache.render(step.value_to_save, { memory: state.namedMemory });
    
    const newImportantMemoryEntry = {
        role: 'system' as const,
        content: `<CONTEXT key="${step.save_to_memory_key}">\n${contentToSave}\n</CONTEXT>`
    };

    log(`Saving to important memory with key: ${step.save_to_memory_key}`);

    const stateUpdates: Partial<SessionState> = {
        namedMemory: {
            ...state.namedMemory,
            [step.save_to_memory_key]: contentToSave,
        },
        importantMemory: [
            ...(state.importantMemory || []),
            newImportantMemoryEntry
        ]
    };

    return {
      contentForUser: null,
      stateUpdates,
    };
  }
}; 