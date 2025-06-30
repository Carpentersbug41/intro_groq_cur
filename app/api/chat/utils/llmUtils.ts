import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function callLlm(
    systemPrompt: string, 
    context: { role: 'user' | 'assistant', content: string }[], 
    model?: string, 
    temperature?: number
): Promise<string> {
    
    console.log(`Calling LLM with model ${model || 'gpt-4o-mini'} and temp ${temperature || 'default'}`);

    try {
        const { text } = await generateText({
            model: openai(model || 'gpt-4o-mini'),
            system: systemPrompt,
            messages: context,
            temperature: temperature || 0.7, // Default temperature
        });

        return text;
    } catch (error) {
        console.error("[LLM_ERROR] Error calling OpenAI:", error);
        return "Sorry, I encountered an error while trying to generate a response.";
    }
} 