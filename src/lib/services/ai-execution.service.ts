/**
 * AI Execution Service
 * Uses provider-agnostic runLLM only; no provider-specific logic here.
 * Existing API contract generate(options): Promise<AIGenerateResult> preserved.
 */

import { runLLM } from '@/lib/services/ai';
import type { AIGenerateResult } from '@/lib/types';

export interface GenerateOptions {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Call configured LLM (Groq or OpenAI) and return generated text.
 */
export async function generate(options: GenerateOptions): Promise<AIGenerateResult> {
  const result = await runLLM({
    system: options.system,
    user: options.user,
    model: options.model,
    maxTokens: options.maxTokens,
  });
  return {
    text: result.text,
    model: result.model,
    usage: result.usage,
  };
}
