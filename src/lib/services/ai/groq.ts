/**
 * Groq provider implementation (Vercel-safe, serverless).
 * Primary production default: free tier, hosted, OpenAI-compatible chat API.
 */

import Groq from 'groq-sdk';
import type { RunLLMOptions, RunLLMResult } from './types';

// Groq free/developer chat default. llama-3.3-70b-versatile shut down 16 Aug 2026.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const RETIRED_GROQ_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': DEFAULT_GROQ_MODEL,
  'llama-3.1-8b-instant': DEFAULT_GROQ_MODEL,
  'llama3-70b-8192': DEFAULT_GROQ_MODEL,
  'llama3-8b-8192': DEFAULT_GROQ_MODEL,
  'mixtral-8x7b-32768': DEFAULT_GROQ_MODEL,
};

function resolveGroqModel(model: string | undefined, hasImages: boolean): string {
  if (hasImages) return GROQ_VISION_MODEL;
  const requested = (model || DEFAULT_GROQ_MODEL).trim();
  return RETIRED_GROQ_MODELS[requested] ?? requested;
}

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function runGroq(options: RunLLMOptions): Promise<RunLLMResult> {
  const { system, user, attachments = [], model, maxTokens = 2048, jsonObject } = options;
  const client = getGroqClient();

  const hasImages = attachments.length > 0;
  const effectiveModel = resolveGroqModel(model, hasImages);

  // Groq vision models reject separate system + user messages with images.
  // Combine system into user content when using attachments.
  const textContent = (user || '').trim() || 'Please answer based on the image(s) and my profile.';
  const userContent = hasImages
    ? [
        { type: 'text' as const, text: system ? `${system}\n\n${textContent}` : textContent },
        ...attachments.map((img) => ({
          type: 'image_url' as const,
          image_url: { url: img.dataUrl },
        })),
      ]
    : textContent;

  const messages = hasImages
    ? [{ role: 'user' as const, content: userContent }]
    : [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: userContent },
      ];

  const completion = await client.chat.completions.create({
    model: effectiveModel,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    ...(jsonObject && !hasImages ? { response_format: { type: 'json_object' as const } } : {}),
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
