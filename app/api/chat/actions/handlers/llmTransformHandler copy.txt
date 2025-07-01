import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';
import { callLlm } from '../../utils/llmUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import mustache from 'mustache';
import { ChatCompletionMessageParam } from 'openai/resources';

export const llmTransformHandler = {
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string, data?: any) => {
      if (typeof data !== 'undefined') {
        console.log(`[req:${requestId}][LLM_TRANSFORM] ${message}\n`, JSON.stringify(data, null, 2));
      } else {
        console.log(`[req:${requestId}][LLM_TRANSFORM] ${message}`);
      }
    };

    if (!step.prompt_template) {
      throw new Error(`Step ${step.id} is missing a prompt_template.`);
    }

    log(`Executing step: ${step.id}`);

    const templatePath = path.join(process.cwd(), 'app', 'api', 'chat', step.prompt_template);
    const template = await fs.readFile(templatePath, 'utf-8');
    const systemPrompt = mustache.render(template, { memory: state.namedMemory });
    log(`System Prompt: "${systemPrompt.substring(0, 150)}..."`);

    // --- CONSTRUCT THE TWO-TIERED MEMORY CONTEXT ---
    const contextMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    if (state.importantMemory && state.importantMemory.length > 0) {
        log(`Injecting ${state.importantMemory.length} entries from importantMemory.`);
        contextMessages.push(...state.importantMemory);
    }

    const bufferSize = step.history_buffer_size ?? 0;
    if (bufferSize > 0) {
      const historySlice = state.conversationHistory.slice(-bufferSize);
      contextMessages.push(...historySlice);
      log(`Adding last ${historySlice.length} messages from history (buffer size: ${bufferSize}).`);
    }

    log('Final context payload prepared for LLM:', contextMessages);

    const llmResponse = await callLlm(systemPrompt, contextMessages, step.model, step.temperature);
    log(`LLM Response Received: "${llmResponse.substring(0, 100)}..."`);

    const stateUpdates: Partial<SessionState> = {
      namedMemory: { ...state.namedMemory },
    };
    if (step.save_to_memory_key) {
      stateUpdates.namedMemory![step.save_to_memory_key] = llmResponse;
    }
    
    return {
      contentForUser: null,
      stateUpdates,
    };
  }
}; 