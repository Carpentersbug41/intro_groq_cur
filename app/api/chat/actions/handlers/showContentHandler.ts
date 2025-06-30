import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';

export const showContentHandler = {
  type: 'SHOW_CONTENT',
  execute: async (step: FlowStep, state: SessionState): Promise<ActionResult> => {
    return {
      contentForUser: step.content || '',
      stateUpdates: {
        currentStepId: step.next_step,
      },
    };
  }
}; 