import { FlowStep, SessionState, ActionResult } from '../../flows/types';

export const askUserHandler = {
  type: 'ASK_USER',
  execute: async (step: FlowStep, state: SessionState): Promise<ActionResult> => {
    return {
      contentForUser: step.content || '',
      stateUpdates: {}, // No state updates, the runner will handle setting the next step ID.
    };
  }
}; 