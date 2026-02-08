/**
 * Groq provider implementation (Vercel-safe, serverless).
 * Primary production default: free tier, hosted, OpenAI-compatible chat API.
 */

import Groq from 'groq-sdk';
import type { RunLLMOptions, RunLLMResult } from './types';

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function runGroq(options: RunLLMOptions): Promise<RunLLMResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const { system, user, model = DEFAULT_GROQ_MODEL, maxTokens = 2048 } = options;
  const client = new Groq({ apiKey });

  const completion = await client.chat.completions.create({
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
        prompt_tokens: completion.usage.prompt_tokens ?? 0,
        completion_tokens: completion.usage.completion_tokens ?? 0,
      }
    : undefined;

  return {
    text,
    model: completion.model ?? model,
    usage,
  };
}
