/**
 * OpenAI provider implementation.
 * Used when LLM_PROVIDER=openai (fallback / local dev).
 */

import OpenAI from 'openai';
import type { RunLLMOptions, RunLLMResult } from './types';

export async function runOpenAI(options: RunLLMOptions): Promise<RunLLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const { system, user, attachments = [], model = 'gpt-4o', maxTokens = 2048 } = options;
  const client = new OpenAI({ apiKey });

  const userContent =
    attachments.length > 0
      ? ([
          { type: 'text', text: user },
          ...attachments.map((img) => ({
            type: 'image_url',
            image_url: { url: img.dataUrl },
          })),
        ] as unknown)
      : user;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent as any },
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
