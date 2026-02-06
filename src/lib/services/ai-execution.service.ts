/**
 * AI Execution Service
 * Calls OpenAI (or swappable provider) with constructed prompt.
 * Returns generated text; optionally saves to DB.
 */

import OpenAI from 'openai';
import type { AIGenerateResult } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateOptions {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Call OpenAI and return generated text. Modular: can swap to another provider by replacing this impl.
 */
export async function generate(options: GenerateOptions): Promise<AIGenerateResult> {
  const { system, user, model = 'gpt-4o', maxTokens = 2048 } = options;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? '';
  const usage = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
      }
    : undefined;

  return {
    text,
    model: completion.model ?? model,
    usage,
  };
}
