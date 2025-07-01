import { FlowStep, SessionState, ActionResult } from '../../flows/types';

export const branchOnMemoryHandler = {
  type: 'BRANCH_ON_MEMORY',
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string) => console.log(`[req:${requestId}][BRANCH_ON_MEMORY] ${message}`);
    const key = step.memory_key_to_check;
    if (!key) throw new Error(`BRANCH_ON_MEMORY step ${step.id} is missing 'memory_key_to_check'.`);
    
    const branches = step.branches;
    if (!branches || !branches.default) throw new Error(`BRANCH_ON_MEMORY step ${step.id} is missing 'branches' or a 'default' branch.`);

    const value = state.namedMemory[key] as string;
    
    let nextStepId = branches[value] || branches.default;

    log(`[session:${state.sessionId}][step:${step.id}] Key:'${key}', Value:'${value}'. Jumping to step:'${nextStepId}'.`);

    return {
      contentForUser: null,
      stateUpdates: {
        currentStepId: nextStepId
      },
    };
  }
}; 