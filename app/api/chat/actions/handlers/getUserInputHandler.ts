import { FlowStep, SessionState, ActionResult } from '../../flows/types';
import { validateInput } from '../../utils/validationUtils'; // This utility needs to be created

export const getUserInputHandler = {
  type: 'GET_USER_INPUT',
  execute: async (step: FlowStep, state: SessionState): Promise<ActionResult> => {
    const userInput = state.conversationHistory.at(-1)?.content || '';
    let isValid = true;
    let nextStepId = step.next_step;

    if (step.validation_rule) {
      isValid = await validateInput(userInput, step.validation_rule);
    }
    
    if (!isValid && step.on_fail_jump_to) {
        nextStepId = step.on_fail_jump_to;
    }

    const stateUpdates: Partial<SessionState> = { currentStepId: nextStepId || null };
    if (step.save_to_memory_key) {
        stateUpdates.namedMemory = { ...state.namedMemory, [step.save_to_memory_key]: userInput };
    }

    return {
      contentForUser: null,
      stateUpdates,
    };
  }
}; 