import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';

export const showContentHandler = {
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string, ...args: any[]) => console.log(`[req:${requestId}][SHOW_CONTENT] ${message}`, ...args);
    log(`Showing content for step ${step.id}:`, step.content);
    // This handler's only job is to return the content from the step.
    // It does not modify memory or control the flow.
    // The runner will take the step's `next_step` to continue the flow.

    return {
      contentForUser: step.content || '',
      stateUpdates: {}, // CRITICAL: Must be empty.
    };
  }
}; 