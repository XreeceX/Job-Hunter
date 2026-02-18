/**
 * POST /api/apply
 * Receive job + application questions from external caller (e.g. Job Tracker),
 * curate answers, and return a structured reply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildPromptWithIntent } from '@/lib/services/prompt-builder.service';
import { generate } from '@/lib/services/ai-execution.service';
import { isLLMConfigured } from '@/lib/services/ai';
import { getOrCreateProfile, upsertProfileQaItems } from '@/lib/services/user-profile.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const questionInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().optional(),
    question: z.string().min(1),
    required: z.boolean().optional(),
  }),
]);

const bodySchema = z
  .object({
    job: z.record(z.string(), z.unknown()).optional(),
    companyName: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),
    location: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    applicationQuestions: z.array(questionInputSchema).min(1),
    followUpAnswers: z
      .array(
        z.object({
          question: z.string().min(1),
          answer: z.string().min(1),
        })
      )
      .optional(),
    intentHint: z
      .enum(['cold_email', 'cover_letter', 'research', 'interview_qa', 'custom'])
      .optional(),
  })
  .superRefine((data, ctx) => {
    const questions = normalizeQuestions(data.applicationQuestions);
    if (questions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'applicationQuestions must include at least one non-empty question',
        path: ['applicationQuestions'],
      });
    }
  });

interface CuratedAnswer {
  id?: string;
  question: string;
  answer: string;
}

interface NormalizedQuestion {
  id?: string;
  question: string;
  required?: boolean;
}

interface ApplyResult {
  needsUserInput: boolean;
  followUpQuestion?: string;
  answers?: CuratedAnswer[];
}

function parseJsonBlock(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

function parseApplyResult(raw: string): ApplyResult {
  const parsed = parseJsonBlock(raw) as {
    needsUserInput?: boolean;
    followUpQuestion?: string;
    answers?: CuratedAnswer[];
  };

  if (parsed.needsUserInput) {
    const question = (parsed.followUpQuestion ?? '').trim();
    if (!question) {
      throw new Error('AI requested user input without a follow-up question.');
    }
    return { needsUserInput: true, followUpQuestion: question };
  }

  const answers = Array.isArray(parsed.answers)
    ? parsed.answers
        .map((entry) => ({
          id: entry?.id,
          question: String(entry?.question ?? '').trim(),
          answer: String(entry?.answer ?? '').trim(),
        }))
        .filter((entry) => entry.question && entry.answer)
    : [];

  return { needsUserInput: false, answers };
}

function normalizeQuestions(
  input: Array<string | { id?: string; question: string; required?: boolean }>
): NormalizedQuestion[] {
  return input
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          question: entry.trim(),
        };
      }
      return {
        id: entry.id?.trim() || undefined,
        question: entry.question.trim(),
        required: entry.required,
      };
    })
    .filter((entry) => entry.question.length > 0);
}

function normalizeJobPayload(payload: z.infer<typeof bodySchema>): Record<string, unknown> {
  const job = payload.job ?? {};
  return {
    ...job,
    companyName:
      payload.companyName ??
      (typeof job.companyName === 'string' ? job.companyName : undefined) ??
      payload.company ??
      (typeof job.company === 'string' ? job.company : undefined),
    company:
      payload.company ??
      (typeof job.company === 'string' ? job.company : undefined) ??
      payload.companyName ??
      (typeof job.companyName === 'string' ? job.companyName : undefined),
    role: payload.role ?? (typeof job.role === 'string' ? job.role : undefined),
    location: payload.location ?? (typeof job.location === 'string' ? job.location : undefined),
    url: payload.url ?? (typeof job.url === 'string' ? job.url : undefined),
    description:
      payload.description ?? (typeof job.description === 'string' ? job.description : undefined),
    source: payload.source ?? (typeof job.source === 'string' ? job.source : undefined),
  };
}

function buildCompanyData(job: Record<string, unknown>): Record<string, unknown> {
  const companyName =
    typeof job.companyName === 'string'
      ? job.companyName
      : typeof job.company === 'string'
        ? job.company
        : undefined;
  return {
    company_name: companyName,
    role: typeof job.role === 'string' ? job.role : undefined,
    website: typeof job.url === 'string' ? job.url : undefined,
    notes: typeof job.description === 'string' ? job.description : undefined,
    location: typeof job.location === 'string' ? job.location : undefined,
    source: typeof job.source === 'string' ? job.source : undefined,
    ...job,
  };
}

function buildApplyUserPrompt(
  applicationQuestions: Array<{ id?: string; question: string; required?: boolean }>
) {
  const questionList = applicationQuestions
    .map((q, idx) => `${idx + 1}. ${q.question}${q.required ? ' (required)' : ''}${q.id ? ` [id:${q.id}]` : ''}`)
    .join('\n');

  return [
    'You are filling a job/internship application form for the user.',
    'Use ONLY the provided context (profile/resume/custom QA + job data).',
    'If a required detail is missing, do NOT invent. Ask one most important follow-up question.',
    'Return STRICT JSON only with one of these shapes:',
    '{"needsUserInput": true, "followUpQuestion": "single question"}',
    '{"needsUserInput": false, "answers": [{"id":"optional","question":"...","answer":"..."}]}',
    '',
    'Questions to answer:',
    questionList,
  ].join('\n');
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST /api/apply.' },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!isLLMConfigured()) {
      return NextResponse.json(
        {
          error:
            'AI not configured. Set LLM_PROVIDER (groq|openai) and the corresponding API key (GROQ_API_KEY or OPENAI_API_KEY).',
        },
        { status: 503 }
      );
    }

    const normalizedJob = normalizeJobPayload(parsed.data);
    const normalizedQuestions = normalizeQuestions(parsed.data.applicationQuestions);
    const { followUpAnswers = [], intentHint } = parsed.data;

    if (followUpAnswers.length > 0) {
      await upsertProfileQaItems(followUpAnswers);
    }

    const profile = await getOrCreateProfile();
    const companyRows = [{ id: 'external-job', data: buildCompanyData(normalizedJob) }];
    const userPrompt = buildApplyUserPrompt(normalizedQuestions);

    const { system, user } = buildPromptWithIntent({
      profile,
      companyRows,
      userPrompt,
      intentHint: intentHint ?? 'custom',
    });

    const result = await generate({
      system,
      user,
      maxTokens: 1600,
    });

    const applyResult = parseApplyResult(result.text);

    if (applyResult.needsUserInput) {
      return NextResponse.json({
        status: 'needs_user_input',
        question: applyResult.followUpQuestion,
        model: result.model,
      });
    }

    const answers = applyResult.answers ?? [];
    return NextResponse.json({
      status: 'completed',
      answers,
      model: result.model,
      usage: result.usage,
    });
  } catch (e) {
    console.error('Apply route error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Application processing failed' },
      { status: 500 }
    );
  }
}
