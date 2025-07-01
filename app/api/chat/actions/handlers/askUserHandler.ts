import { FlowStep, SessionState, ActionResult } from '../../flows/types';

export const askUserHandler = {
  type: 'ASK_USER',
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string, ...args: any[]) => console.log(`[req:${requestId}][ASK_USER] ${message}`, ...args);
    log(`Pausing for user input. Content:`, step.content);
    return {
      contentForUser: step.content || '',
      stateUpdates: {}, // No state updates, the runner will handle setting the next step ID.
    };
  }
}; 