/**
 * POST /api/applications/:id/analyze-jd — store JD text and return extracted fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApplication, updateApplication, serializeJobApplication } from '@/lib/services/job-application.service';
import { getOrCreateProfile } from '@/lib/services/user-profile.service';
import { analyzeJobDescription } from '@/lib/services/job-copilot/llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  jdText: z.string().min(10).max(500000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const app = await getApplication(id);
    if (!app) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await getOrCreateProfile();
    const resumeText = profile.resumeText ?? '';

    const { analysis, offline } = await analyzeJobDescription(parsed.data.jdText, resumeText);

    const updated = await updateApplication(id, {
      jdText: parsed.data.jdText,
      jdAnalysis: analysis,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      application: serializeJobApplication(updated),
      jd_analysis: analysis,
      offline,
    });
  } catch (e) {
    console.error('analyze-jd error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to analyze job description' },
      { status: 500 }
    );
  }
}
