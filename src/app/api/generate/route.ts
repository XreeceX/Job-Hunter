/**
 * POST /api/generate
 * Build prompt from selected companies + profile + user request, call AI, return output.
 * Body: { companyRowIds: string[], userPrompt: string, intentHint?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateProfile, upsertProfileQaItems } from '@/lib/services/user-profile.service';
import { buildPromptWithIntent, fetchPortfolioContent } from '@/lib/services/prompt-builder.service';
import { generate } from '@/lib/services/ai-execution.service';
import { isLLMConfigured } from '@/lib/services/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    companyRowIds: z.array(z.string()).min(0),
    userPrompt: z.string().default(''),
    intentHint: z
      .enum(['cold_email', 'cover_letter', 'research', 'interview_qa', 'custom'])
      .optional(),
    followUpAnswers: z
      .array(
        z.object({
          question: z.string().min(1),
          answer: z.string().min(1),
        })
      )
      .optional(),
    attachments: z
      .array(
        z.object({
          dataUrl: z.string().startsWith('data:image/'),
          mimeType: z.string().optional(),
        })
      )
      .max(5)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasPrompt = data.userPrompt.trim().length > 0;
    const hasAttachments = (data.attachments?.length ?? 0) > 0;
    if (!hasPrompt && !hasAttachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a request or paste an image.',
        path: ['userPrompt'],
      });
    }
  });

interface MissingInfoResult {
  needsUserInput: boolean;
  question?: string;
}

function parseMissingInfoResponse(text: string): MissingInfoResult {
  if (!text.trim()) return { needsUserInput: false };
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { needsUserInput?: boolean; question?: string };
    if (!parsed.needsUserInput) return { needsUserInput: false };
    const question = (parsed.question ?? '').trim();
    if (!question) return { needsUserInput: false };
    return { needsUserInput: true, question };
  } catch {
    return { needsUserInput: false };
  }
}

async function detectMissingApplicationInfo(system: string, user: string): Promise<MissingInfoResult> {
  const detectorSystem =
    'You detect if user input is missing for job/internship application form answers. Return strict JSON only.';
  const detectorUser = [
    'Task:',
    '- Decide whether the user is asking to fill/curate answers for a job or internship application form.',
    '- If not, return {"needsUserInput": false}.',
    '- If yes, and required info is missing from provided context, return {"needsUserInput": true, "question": "..."}',
    '- Ask only ONE most important missing question.',
    '- If context already has enough information, return {"needsUserInput": false}.',
    '',
    'Context passed to generator:',
    `SYSTEM:\n${system}`,
    `USER:\n${user}`,
  ].join('\n');
  const result = await generate({
    system: detectorSystem,
    user: detectorUser,
    maxTokens: 220,
  });
  return parseMissingInfoResponse(result.text);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { companyRowIds, userPrompt, intentHint, followUpAnswers = [], attachments = [] } = parsed.data;

    const [initialProfile, companyRows] = await Promise.all([
      getOrCreateProfile(),
      companyRowIds.length > 0
        ? prisma.companyRow.findMany({
            where: { id: { in: companyRowIds } },
            select: { id: true, data: true },
          })
        : Promise.resolve([]),
    ]);

    if (followUpAnswers.length > 0) {
      await upsertProfileQaItems(followUpAnswers);
    }

    if (companyRowIds.length > 0 && companyRows.length === 0) {
      return NextResponse.json(
        {
          error:
            'No companies found with the provided IDs. Please refresh the page and select companies again.',
        },
        { status: 404 }
      );
    }

    const orderedRows = companyRowIds
      .map((id) => companyRows.find((r) => r.id === id))
      .filter(Boolean) as { id: string; data: Record<string, unknown> }[];

    if (companyRowIds.length > 0 && orderedRows.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not match company IDs. Please refresh the page and select companies again.',
        },
        { status: 400 }
      );
    }

    const profile = followUpAnswers.length > 0 ? await getOrCreateProfile() : initialProfile;

    const portfolioContent = await fetchPortfolioContent(profile.portfolioUrl);

    const ctx = {
      profile,
      companyRows: orderedRows,
      userPrompt,
      intentHint,
      portfolioContent,
    };

    if (!isLLMConfigured()) {
      return NextResponse.json(
        {
          error:
            'AI not configured. Set LLM_PROVIDER (groq|openai) and the corresponding API key (GROQ_API_KEY or OPENAI_API_KEY).',
        },
        { status: 503 }
      );
    }

    const { system, user } = buildPromptWithIntent(ctx);

    if (followUpAnswers.length === 0) {
      const missingInfo = await detectMissingApplicationInfo(system, user);
      if (missingInfo.needsUserInput && missingInfo.question) {
        return NextResponse.json({
          needsUserInput: true,
          question: missingInfo.question,
        });
      }
    }

    const result = await generate({ system, user, attachments });

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
