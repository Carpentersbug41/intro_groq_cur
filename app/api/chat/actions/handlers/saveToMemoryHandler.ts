import { FlowStep, SessionState, ActionResult } from '../../flows/types';
import mustache from 'mustache';

export const saveToMemoryHandler = {
  type: 'SAVE_TO_MEMORY',
  execute: async (step: FlowStep, state: SessionState): Promise<ActionResult> => {
    const key = step.save_to_memory_key;
    if (!key) throw new Error(`SAVE_TO_MEMORY step ${step.id} is missing 'save_to_memory_key'.`);

    const valueToSave = step.value_to_save;
    if (valueToSave === undefined) throw new Error(`SAVE_TO_MEMORY step ${step.id} is missing 'value_to_save'.`);

    // Render the value with mustache in case it contains memory variables
    const renderedValue = mustache.render(valueToSave, { memory: state.namedMemory });

    console.log(`[SAVE_TO_MEMORY][session:${state.sessionId}][step:${step.id}] Saving Key:'${key}', Value:'${renderedValue}'.`);

    return {
      contentForUser: null,
      stateUpdates: {
        currentStepId: step.next_step,
        namedMemory: {
          [key]: renderedValue,
        },
      },
    };
  }
}; 