import { z } from 'zod';
import OpenAI from 'openai';
import Instructor from '@instructor-ai/instructor';

// Define a more flexible schema for validation output.
const validationSchema = z.object({
  // The user's intent, which can be affirmative, negative, or unclear.
  intent: z.enum(['affirmative', 'negative', 'unclear']).describe("The user's intent."),
  // A brief explanation of why the decision was made.
  reasoning: z.string().describe('A brief explanation of the validation result.'),
});

// Create an OpenAI client
const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create an instructor-powered validation client.
const client = Instructor({
  client: oai,
  mode: 'TOOLS',
});

/**
 * Validates user input against a specified rule using an LLM.
 * @param input The user's text input.
 * @param rule The validation rule to apply (e.g., 'is_affirmative').
 * @returns A boolean indicating whether the input is valid.
 */
export async function validateInput(input: string, rule: string): Promise<boolean> {
  const supportedRules = ['is_affirmative', 'is_affirmative_or_negative'];
  if (!supportedRules.includes(rule)) {
    console.warn(`[Validation] Unsupported validation rule: "${rule}". Defaulting to true.`);
    return true;
  }

  try {
    const validationResult = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a validation expert. Your task is to determine if the user's response to a yes/no question is affirmative, negative, or unclear. Consider variations, sarcasm, and indirect answers.`,
        },
        { role: 'user', content: input },
      ],
      model: 'gpt-3.5-turbo',
      response_model: { schema: validationSchema, name: 'validate_intent' },
      max_retries: 2,
    });

    const { intent, reasoning } = validationResult;
    console.log(`[Validation] Input: "${input}" | Intent: ${intent} | Reasoning: ${reasoning}`);

    if (rule === 'is_affirmative') {
      return intent === 'affirmative';
    }

    if (rule === 'is_affirmative_or_negative') {
      return intent === 'affirmative' || intent === 'negative';
    }
    
    // Should not be reached due to the check at the top, but here as a fallback.
    return false;

  } catch (error) {
    console.error('[Validation] Error during LLM validation:', error);
    // Default to false on error to be safe.
    return false;
  }
} 