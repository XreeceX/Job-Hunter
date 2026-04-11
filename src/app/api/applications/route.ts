/**
 * POST /api/applications — create
 * GET /api/applications — list (optional ?status=&q=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';
import {
  createApplication,
  listApplications,
  serializeJobApplication,
} from '@/lib/services/job-application.service';

export const dynamic = 'force-dynamic';

const statusValues = ['WISHLIST', 'APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER'] as const;

function parseStatus(s: string | null): ApplicationStatus | undefined {
  if (!s) return undefined;
  const u = s.toUpperCase();
  if (statusValues.includes(u as (typeof statusValues)[number])) {
    return u as ApplicationStatus;
  }
  return undefined;
}

const createSchema = z.object({
  company: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  postingUrl: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  status: z.nativeEnum(ApplicationStatus).optional(),
  appliedDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const status = parseStatus(searchParams.get('status'));
    const rows = await listApplications({ search: q ?? undefined, status });
    return NextResponse.json({
      applications: rows.map(serializeJobApplication),
    });
  } catch (e) {
    console.error('applications list error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const appliedDate = parsed.data.appliedDate ? new Date(parsed.data.appliedDate) : null;
    const row = await createApplication({
      company: parsed.data.company,
      title: parsed.data.title,
      postingUrl: parsed.data.postingUrl ?? null,
      status: parsed.data.status,
      appliedDate,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json({ application: serializeJobApplication(row) }, { status: 201 });
  } catch (e) {
    console.error('applications create error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create application' },
      { status: 500 }
    );
  }
}
