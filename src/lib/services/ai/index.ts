/**
 * Provider-agnostic LLM router.
 * Rest of the app imports only runLLM from here; no direct OpenAI/Groq usage.
 * Provider selected via LLM_PROVIDER (default: groq for production).
 */

import type { RunLLMOptions, RunLLMResult, LLMProviderId } from './types';
import { runGroq } from './groq';
import { runOpenAI } from './openai';

function getProvider(): LLMProviderId {
  const v = (process.env.LLM_PROVIDER ?? 'groq').toLowerCase();
  if (v === 'openai') return 'openai';
  return 'groq';
}

/**
 * Whether the configured provider has its API key set (for route-level checks).
 */
export function isLLMConfigured(): boolean {
  const provider = getProvider();
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Run the configured LLM with system + user prompt.
 * Contract: same options and result shape regardless of provider.
 */
export async function runLLM(options: RunLLMOptions): Promise<RunLLMResult> {
  const provider = getProvider();
  if (provider === 'openai') {
    return runOpenAI(options);
  }
  return runGroq(options);
}

export type { RunLLMOptions, RunLLMResult, LLMProviderId } from './types';
