/**
 * Provider-agnostic types for the AI layer.
 * No OpenAI/Groq types leak outside this folder.
 */

export interface RunLLMOptions {
  system: string;
  user: string;
  attachments?: Array<{
    dataUrl: string;
    mimeType?: string;
  }>;
  model?: string;
  maxTokens?: number;
  /** Ask the model for JSON object output (OpenAI / Groq compatible). */
  jsonObject?: boolean;
}

export interface RunLLMResult {
  text: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export type LLMProviderId = 'groq' | 'openai';
