import { actionHandlers } from '../actions/registry';
import mustache from 'mustache';
import { Flow, SessionState, ActionResult, FlowStep } from '@/app/api/chat/flows/types';

export interface TurnResult {
  messagesForUser: { role: 'assistant'; content: string }[];
  finalState: SessionState;
}

export async function executeTurn(
  flow: Flow, 
  initialState: SessionState,
  requestId: string
): Promise<TurnResult> {
  const log = (message: string, data?: any) => {
    if (typeof data !== 'undefined') {
      console.log(`[req:${requestId}][RUNNER] ${message}\n`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[req:${requestId}][RUNNER] ${message}`);
    }
  };
  let currentState = { ...initialState };
  const messagesForUser: { role: 'assistant'; content: string }[] = [];
  let currentStepId: string | null = currentState.currentStepId;

  if (!currentStepId) {
    currentStepId = flow.steps[0]?.id || null;
    currentState.currentStepId = currentStepId;
  }

  log(`--- Turn Start ---`);
  log(`Initial Step ID: ${currentStepId}`);
  log('Initial memory: ', currentState.namedMemory);

  // --- HARDENED Auto-transition loop with Error Handling ---
  while (currentStepId) {
    const step = flow.steps.find((s: FlowStep) => s.id === currentStepId);

    if (!step) {
        log(`[CRITICAL] Step not found in flow: ${currentStepId}`);
        messagesForUser.push({ role: 'assistant', content: "I've encountered an internal error and cannot continue. Please try starting a new chat." });
        break; // Exit the loop on critical flow error
    }

    const handler = actionHandlers[step.action];
    if (!handler) {
        log(`[CRITICAL] No handler found for action type: ${step.action} at step ${step.id}`);
        messagesForUser.push({ role: 'assistant', content: "I've encountered an internal error and cannot continue. Please try starting a new chat." });
        break; // Exit the loop on critical flow error
    }

    let result: ActionResult;
    try {
        log(`[session:${currentState.sessionId}][step:${step.id}] Executing action: ${step.action}`);
        result = await handler.execute(step, currentState, requestId);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`[ERROR] Action handler for step '${step.id}' (${step.action}) failed. Error: ${errorMessage}`);
        messagesForUser.push({ role: 'assistant', content: "I'm sorry, I ran into a problem trying to process that. Let's try again." });
        // On handler failure, we break the loop and end the turn.
        // The user can then retry their last message.
        currentState.currentStepId = step.id; // Reset to the failed step for the next turn.
        break;
    }

    const idBeforeAction = currentState.currentStepId;

    currentState = {
        ...currentState,
        ...result.stateUpdates,
        namedMemory: { ...currentState.namedMemory, ...result.stateUpdates?.namedMemory },
    };
    
    log(`Memory after step '${step.id}': `, currentState.namedMemory);

    if (result.contentForUser) {
        const renderedContent = mustache.render(result.contentForUser, { memory: currentState.namedMemory });
        messagesForUser.push({ role: 'assistant', content: renderedContent });
        currentState.conversationHistory.push({ role: 'assistant', content: renderedContent });
        log(`Added message for user:`, renderedContent);
    }

    if (step.wait_time_ms && result.contentForUser) {
        await new Promise(resolve => setTimeout(resolve, step.wait_time_ms));
    }
    
    const isTerminalAction = step.is_terminal === true || step.action === 'ASK_USER';

    let nextStepId: string | null;

    if (currentState.currentStepId !== idBeforeAction) {
        nextStepId = currentState.currentStepId;
        log(`Branching action changed flow to: ${nextStepId}`);
    } else {
        nextStepId = step.next_step || null;
    }
    
    if (isTerminalAction) {
        currentState.currentStepId = nextStepId;
        log(`Loop Break: Terminal action. Next step for next turn is ${currentState.currentStepId}`);
        break; 
    }

    currentStepId = nextStepId;
    currentState.currentStepId = nextStepId;
    
    if (currentStepId) {
        log(`Loop Continue: Auto-transitioning to step ${currentStepId}`);
    } else {
        log(`Loop End: No next step defined.`);
    }
  }

  log(`--- Turn End ---`);

  return {
    messagesForUser,
    finalState: currentState,
  };
} 