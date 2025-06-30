import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';
import { callLlm } from '../../utils/llmUtils'; // This utility needs to be created
import * as fs from 'fs/promises';
import * as path from 'path';
import mustache from 'mustache';

export const llmTransformHandler = {
  type: 'LLM_TRANSFORM',
  execute: async (step: FlowStep, state: SessionState): Promise<ActionResult> => {
    if (!step.prompt_template) throw new Error("LLM_TRANSFORM requires a prompt_template");

    // Load the prompt template from the file system
    const templatePath = path.join(process.cwd(), 'app/api/chat', step.prompt_template);
    const template = await fs.readFile(templatePath, 'utf-8');

    // Populate the template with memory
    const systemPrompt = mustache.render(template, { memory: state.namedMemory });
    
    // Build context (a simplified version for now)
    const context = [...state.conversationHistory]; // Add required_memory logic here later

    const llmResponse = await callLlm(systemPrompt, context, step.model, step.temperature);

    const stateUpdates: Partial<SessionState> = {};
    if (step.save_to_memory_key) {
        stateUpdates.namedMemory = { ...state.namedMemory, [step.save_to_memory_key]: llmResponse };
    }
    stateUpdates.currentStepId = step.next_step;

    return {
      contentForUser: null, // This action is silent
      stateUpdates,
    };
  }
}; 