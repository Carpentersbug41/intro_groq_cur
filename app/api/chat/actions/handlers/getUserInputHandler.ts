import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';
import { validateInput } from '../../utils/validationUtils'; // This utility needs to be created

export const getUserInputHandler = {
  type: 'GET_USER_INPUT',
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string) => console.log(`[req:${requestId}][GET_USER_INPUT] ${message}`);
    // Get the last user message from the history
    const lastUserMessage = state.conversationHistory.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      log(`[WARN] No user message found in history for step ${step.id}`);
      return { contentForUser: null, stateUpdates: {} };
    }

    const memoryKey = step.save_to_memory_key || 'last_user_input';
    log(`Saving user input to memory key: '${memoryKey}'`);
    
    const stateUpdates = {
      namedMemory: {
        [memoryKey]: lastUserMessage.content,
      }
    };

    // THIS HANDLER IS NON-TERMINAL AND DOES NOT BRANCH.
    // DO NOT set currentStepId here. The runner handles it.
    return {
      contentForUser: null,
      stateUpdates,
    };
  }
}; 