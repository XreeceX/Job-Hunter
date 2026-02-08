/**
 * POST /api/generate
 * Build prompt from selected companies + profile + user request, call AI, return output.
 * Body: { companyRowIds: string[], userPrompt: string, intentHint?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateProfile } from '@/lib/services/user-profile.service';
import { buildPromptWithIntent } from '@/lib/services/prompt-builder.service';
import { generate } from '@/lib/services/ai-execution.service';
import { isLLMConfigured } from '@/lib/services/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  companyRowIds: z.array(z.string()).min(0),
  userPrompt: z.string().min(1),
  intentHint: z
    .enum(['cold_email', 'cover_letter', 'research', 'interview_qa', 'custom'])
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { companyRowIds, userPrompt, intentHint } = parsed.data;

    const [profile, companyRows] = await Promise.all([
      getOrCreateProfile(),
      companyRowIds.length > 0
        ? prisma.companyRow.findMany({
            where: { id: { in: companyRowIds } },
            select: { id: true, data: true },
          })
        : Promise.resolve([]),
    ]);

    const orderedRows = companyRowIds
      .map((id) => companyRows.find((r) => r.id === id))
      .filter(Boolean) as { id: string; data: Record<string, unknown> }[];

    const ctx = {
      profile,
      companyRows: orderedRows,
      userPrompt,
      intentHint,
    };

    const { system, user } = buildPromptWithIntent(ctx);

    if (!isLLMConfigured()) {
      return NextResponse.json(
        {
          error:
            'AI not configured. Set LLM_PROVIDER (groq|openai) and the corresponding API key (GROQ_API_KEY or OPENAI_API_KEY).',
        },
        { status: 503 }
      );
    }

    const result = await generate({ system, user });

    await prisma.generatedOutput.create({
      data: {
        promptUsed: user.slice(0, 2000),
        request: userPrompt,
        output: result.text,
        companyIds: companyRowIds,
      },
    });

    return NextResponse.json({
      text: result.text,
      model: result.model,
      usage: result.usage,
    });
  } catch (e) {
    console.error('Generate error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
