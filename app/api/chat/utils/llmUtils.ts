import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.7;

export async function callLlm(
  messages: ChatCompletionMessageParam[],
  model?: string,
  temperature?: number
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: messages,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
    });
    
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('LLM response was empty or malformed.');
    }

    return content.trim();

  } catch (error) {
    console.error('[llmUtils] - CRITICAL ERROR calling OpenAI:', error);
    // In a real app, you might want more sophisticated error handling,
    // but for now, re-throwing ensures the flow stops.
    throw new Error('Failed to get a response from the LLM.');
  }
} 