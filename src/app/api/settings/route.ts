/**
 * GET /api/settings — non-secret LLM configuration (from env)
 */

import { NextResponse } from 'next/server';
import { isLLMConfigured } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = (process.env.LLM_PROVIDER ?? 'groq').toLowerCase();
  const model = process.env.LLM_MODEL?.trim() || null;
  return NextResponse.json({
    llmProvider: provider === 'openai' ? 'openai' : 'groq',
    llmModel: model,
    llmConfigured: isLLMConfigured(),
  });
}
