import { actionHandlers } from '../actions/registry';
import { Flow, SessionState, ActionResult, FlowStep } from '@/app/api/chat/flows/types';
import mustache from 'mustache'; 

export interface TurnResult {
  messagesForUser: { role: 'assistant', content: string }[];
  finalState: SessionState;
}

export async function executeTurn(
  flow: Flow, 
  initialState: SessionState
): Promise<TurnResult> {
  let currentState = { ...initialState };
  const messagesForUser: { role: 'assistant', content: string }[] = [];
  let currentStepId: string | null = currentState.currentStepId;

  // If the last flow finished, reset to the start for the new turn.
  if (currentStepId === null) {
      currentStepId = flow.steps[0]?.id || null;
      currentState.currentStepId = currentStepId;
  }

  console.log(`[RUNNER-DEBUG] --- Turn Start ---`);
  console.log(`[RUNNER-DEBUG] Initial Step ID: ${currentStepId}`);
  console.log(`[RUNNER-PAYLOAD] Initial memory:`, JSON.stringify(currentState.namedMemory, null, 2));

  // The auto-transition loop
  console.log(`[RUNNER-DEBUG] Entering auto-transition loop...`);
  while (currentStepId) {
    console.log(`[RUNNER-DEBUG] Loop Top: currentStepId is ${currentStepId}`);
    const step = flow.steps.find((s: FlowStep) => s.id === currentStepId);
    if (!step) {
      console.error(`[RUNNER-CRITICAL] Step not found in flow: ${currentStepId}`);
      throw new Error(`Step not found in flow: ${currentStepId}`);
    }

    const handler = actionHandlers[step.action];
    if (!handler) {
      console.error(`[RUNNER-CRITICAL] No handler found for action type: ${step.action}`);
      throw new Error(`No handler found for action type: ${step.action}`);
    }

    console.log(`[RUNNER][session:${currentState.sessionId}][step:${step.id}] Executing action: ${step.action}`);

    // Execute the action for the current step
    const result: ActionResult = await handler.execute(step, currentState);

    // Merge state updates
    currentState = {
        ...currentState,
        ...result.stateUpdates,
        namedMemory: { ...currentState.namedMemory, ...result.stateUpdates.namedMemory },
    };
    console.log(`[RUNNER-DEBUG] Action executed. State updated.`);
    console.log(`[RUNNER-PAYLOAD] Memory after step '${step.id}':`, JSON.stringify(currentState.namedMemory, null, 2));

    if (result.contentForUser) {
        // Render any mustache templates in the content before sending
        const renderedContent = mustache.render(result.contentForUser, { memory: currentState.namedMemory });
        messagesForUser.push({ role: 'assistant', content: renderedContent });
        console.log(`[RUNNER-DEBUG] Added content for user: "${renderedContent.substring(0, 50)}..."`);
    }

    // Apply UX delay if specified
    if (step.wait_time_ms && result.contentForUser) {
        await new Promise(resolve => setTimeout(resolve, step.wait_time_ms));
    }
    
    // Determine if the loop should break. An action is considered terminal if it's
    // an ASK_USER action by default, or if its `is_terminal` flag is explicitly set.
    const isTerminalAction = step.is_terminal ?? (step.action === 'ASK_USER');
    console.log(`[RUNNER-DEBUG] Is terminal action? ${isTerminalAction} (Action: ${step.action}, Flag: ${step.is_terminal})`);
    if (isTerminalAction) {
        // The last action was terminal, so the turn is over.
        // Update the state to point to the next step, ready for the *next* user input.
        currentState.currentStepId = step.next_step || null;
        console.log(`[RUNNER-DEBUG] Loop Break: Terminal action. Next step ID will be ${currentState.currentStepId}`);
        break;
    }

    // If not terminal, immediately proceed to the next step ID from the *updated* state.
    // This allows actions like BRANCH_ON_MEMORY to control the flow.
    currentStepId = currentState.currentStepId;
    console.log(`[RUNNER-DEBUG] Loop Continue: Not terminal. Next step ID is ${currentStepId}`);
  }
  console.log(`[RUNNER-DEBUG] --- Turn End ---`);

  // History is now managed within the loop and at the start. Remove redundant additions.

  // Add the assistant's messages to the history for the next turn
  currentState.conversationHistory.push(...messagesForUser);


  return {
    messagesForUser,
    finalState: currentState,
  };
} 