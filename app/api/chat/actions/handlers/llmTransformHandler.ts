import { FlowStep, SessionState, ActionResult } from '@/app/api/chat/flows/types';
import { callLlm } from '../../utils/llmUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import mustache from 'mustache';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const llmTransformHandler = {
  execute: async (step: FlowStep, state: SessionState, requestId: string): Promise<ActionResult> => {
    const log = (message: string, data?: any) => {
      if (typeof data !== 'undefined') {
        console.log(`[req:${requestId}][LLM_TRANSFORM] ${message}`);
        console.dir(data, { depth: null });
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
    log("System Prompt:", systemPrompt);

    // --- CONSTRUCT THE COMPLETE MESSAGE PAYLOAD ---
    const allMessages: ChatCompletionMessageParam[] = [];

    // 1. Add the System Prompt
    allMessages.push({ role: 'system', content: systemPrompt });

    // 2. Add Important Memory
    if (state.importantMemory && state.importantMemory.length > 0) {
        log(`Injecting ${state.importantMemory.length} entries from importantMemory.`);
        allMessages.push(...state.importantMemory);
    }

    // 3. Add Buffered History
    const bufferSize = step.history_buffer_size ?? 0;
    if (bufferSize > 0) {
      const historySlice = state.conversationHistory.slice(-bufferSize);
      allMessages.push(...historySlice);
      log(`Adding last ${historySlice.length} messages from history (buffer size: ${bufferSize}).`);
    }

    log('Final payload prepared for LLM:', allMessages);

    const llmResponse = await callLlm(allMessages, step.model, step.temperature);
    log("LLM Response Received:", llmResponse);

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