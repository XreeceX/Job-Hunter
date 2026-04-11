/**
 * POST /api/applications/:id/generate — tailored bullets, cover letter, answers
 * Optional JSON body: { "jdText": "..." } to persist latest JD from the client before generating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApplication, updateApplication, serializeJobApplication } from '@/lib/services/job-application.service';
import { getOrCreateProfile } from '@/lib/services/user-profile.service';
import { generateApplicationPack } from '@/lib/services/job-copilot/llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  jdText: z.string().max(500000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let app = await getApplication(id);
    if (!app) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const raw = await request.text();
    if (raw) {
      try {
        const json = JSON.parse(raw);
        const parsed = bodySchema.safeParse(json);
        if (parsed.success && parsed.data.jdText !== undefined) {
          const updated = await updateApplication(id, { jdText: parsed.data.jdText });
          if (updated) app = updated;
        }
      } catch {
        // ignore empty or non-JSON body
      }
    }

    const profile = await getOrCreateProfile();
    const baselineResume = profile.resumeText ?? '';
    if (!baselineResume.trim()) {
      return NextResponse.json(
        {
          error:
            'Baseline resume is empty. Add resume text or upload a resume in Profile & resume before generating.',
        },
        { status: 400 }
      );
    }

    const jdText = app.jdText?.trim() ?? '';
    if (jdText.length < 10) {
      return NextResponse.json(
        { error: 'Paste a job description and run Analyze first (or include JD text on the application).' },
        { status: 400 }
      );
    }

    const { pack, offline } = await generateApplicationPack({
      baselineResume,
      jdText,
      company: app.company,
      title: app.title,
    });

    const payload = {
      resume_bullets: pack.resume_bullet_suggestions,
      cover_letter: pack.cover_letter,
      answers: pack.short_answers,
      warnings: pack.warnings,
      offline,
    };

    const updated = await updateApplication(id, {
      lastGeneration: payload,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      application: serializeJobApplication(updated),
      ...payload,
    });
  } catch (e) {
    console.error('generate error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
