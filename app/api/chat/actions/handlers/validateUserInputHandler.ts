import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';

export const validateUserInputHandler = {
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string) => console.log(`[req:${requestId}][VALIDATE_USER_INPUT] ${message}`);

    log(`Stub handler for VALIDATE_USER_INPUT. This action is not yet implemented.`);
    
    // In a real implementation, this handler would check state.conversationHistory
    // against rules defined in step.validation_rule.
    // For now, it will always "succeed" and do nothing.

    return {
      contentForUser: null,
      stateUpdates: {},
    };
  }
}; 