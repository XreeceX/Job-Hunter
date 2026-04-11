/**
 * GET /api/applications/:id
 * PATCH /api/applications/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';
import {
  deleteApplication,
  getApplication,
  updateApplication,
  serializeJobApplication,
} from '@/lib/services/job-application.service';

export const dynamic = 'force-dynamic';

const lastGenSchema = z
  .object({
    resume_bullets: z.array(z.any()).optional(),
    cover_letter: z.string().optional(),
    answers: z.record(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    offline: z.boolean().optional(),
  })
  .passthrough();

const patchSchema = z.object({
  company: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  postingUrl: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  status: z.nativeEnum(ApplicationStatus).optional(),
  appliedDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),
  jdText: z.string().max(500000).nullable().optional(),
  lastGeneration: lastGenSchema.nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const row = await getApplication(id);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ application: serializeJobApplication(row) });
  } catch (e) {
    console.error('application get error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load application' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const appliedDate =
      parsed.data.appliedDate !== undefined
        ? parsed.data.appliedDate
          ? new Date(parsed.data.appliedDate)
          : null
        : undefined;

    const { lastGeneration, ...rest } = parsed.data;
    const row = await updateApplication(id, {
      ...rest,
      appliedDate,
      ...(lastGeneration !== undefined ? { lastGeneration } : {}),
    });
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ application: serializeJobApplication(row) });
  } catch (e) {
    console.error('application patch error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update application' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = await deleteApplication(id);
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('application delete error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete application' },
      { status: 500 }
    );
  }
}
