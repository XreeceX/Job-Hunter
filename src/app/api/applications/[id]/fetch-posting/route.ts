/**
 * POST /api/applications/:id/fetch-posting — re-fetch posting URL and update company/title/jdText.
 * Body optional: { "url": "https://..." } (defaults to application.postingUrl)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchJobPostingFromUrl } from '@/lib/services/job-url-fetcher.service';
import { getApplication, updateApplication, serializeJobApplication } from '@/lib/services/job-application.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(8).max(2000).optional(),
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

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const rawUrl = parsed.data.url?.trim() || app.postingUrl?.trim();
    if (!rawUrl) {
      return NextResponse.json(
        { error: 'No URL: set a posting URL on this application or send { "url": "..." } in the body.' },
        { status: 400 }
      );
    }

    const result = await fetchJobPostingFromUrl(rawUrl);

    const company = result.suggestedCompany?.trim() || app.company;
    const title = result.suggestedTitle?.trim() || app.title;

    const updated = await updateApplication(id, {
      postingUrl: result.normalizedUrl,
      company,
      title,
      jdText: result.jdText,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      application: serializeJobApplication(updated),
      warnings: result.warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch posting';
    console.error('fetch-posting:', msg);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
