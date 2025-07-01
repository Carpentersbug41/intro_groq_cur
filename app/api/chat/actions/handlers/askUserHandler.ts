import { FlowStep, SessionState, ActionResult } from '../../flows/types';

export const askUserHandler = {
  type: 'ASK_USER',
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string) => console.log(`[req:${requestId}][ASK_USER] ${message}`);
    log(`Pausing for user input. Content: "${step.content?.substring(0,50)}..."`);
    return {
      contentForUser: step.content || '',
      stateUpdates: {}, // No state updates, the runner will handle setting the next step ID.
    };
  }
}; 