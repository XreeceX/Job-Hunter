/**
 * Groq provider implementation (Vercel-safe, serverless).
 * Primary production default: free tier, hosted, OpenAI-compatible chat API.
 */

import Groq from 'groq-sdk';
import type { RunLLMOptions, RunLLMResult } from './types';

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
  const { system, user, attachments = [], model, maxTokens = 2048 } = options;
  const client = getGroqClient();

  const hasImages = attachments.length > 0;
  const effectiveModel = model ?? (hasImages ? GROQ_VISION_MODEL : DEFAULT_GROQ_MODEL);

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
