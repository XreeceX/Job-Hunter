/**
 * POST /api/test-llm — minimal LLM connectivity check (same provider as production)
 */

import { NextResponse } from 'next/server';
import { isLLMConfigured, runLLM } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No LLM API key configured. Set GROQ_API_KEY or OPENAI_API_KEY (and LLM_PROVIDER).',
        },
        { status: 503 }
      );
    }

    const result = await runLLM({
      system: 'Reply with exactly one word: ok',
      user: 'Say ok.',
      maxTokens: 8,
    });

    return NextResponse.json({
      ok: true,
      model: result.model,
      sample: result.text.slice(0, 100),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('test-llm error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
