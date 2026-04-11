/**
 * POST /api/job-url/preview — fetch a job posting URL and return parsed fields (no DB write).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchJobPostingFromUrl } from '@/lib/services/job-url-fetcher.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(8).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await fetchJobPostingFromUrl(parsed.data.url);
    return NextResponse.json({
      normalizedUrl: result.normalizedUrl,
      suggestedCompany: result.suggestedCompany,
      suggestedTitle: result.suggestedTitle,
      jdText: result.jdText,
      pageTitle: result.pageTitle,
      warnings: result.warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch URL';
    console.error('job-url preview:', msg);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
