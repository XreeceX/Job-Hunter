/**
 * GET /api/applications/:id/export-md — Markdown bundle for one application
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApplication } from '@/lib/services/job-application.service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const app = await getApplication(id);
    if (!app) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const gen = app.lastGeneration as {
      resume_bullets?: unknown[];
      cover_letter?: string;
      answers?: Record<string, string>;
      warnings?: string[];
    } | null;

    const lines: string[] = [
      `# Application: ${app.title}`,
      ``,
      `- **Company:** ${app.company}`,
      `- **Status:** ${app.status}`,
      `- **Posting URL:** ${app.postingUrl ?? '—'}`,
      `- **Applied:** ${app.appliedDate?.toISOString().slice(0, 10) ?? '—'}`,
      ``,
      `## Job description`,
      ``,
      app.jdText?.trim() || '_No JD stored._',
      ``,
    ];

    if (app.jdAnalysis) {
      lines.push(`## JD analysis`, ``, '```json', JSON.stringify(app.jdAnalysis, null, 2), '```', ``);
    }

    if (gen) {
      lines.push(`## Generated cover letter`, ``, gen.cover_letter ?? '_None._', ``);
      lines.push(`## Resume bullet suggestions`, ``);
      const bullets = gen.resume_bullets ?? [];
      for (const b of bullets) {
        if (b && typeof b === 'object' && 'original' in b && 'suggested' in b) {
          const o = b as { original: string; suggested: string; rationale?: string };
          lines.push(`### Original`, o.original, ``, `### Suggested`, o.suggested, ``);
          if (o.rationale) lines.push(`_Rationale:_ ${o.rationale}`, ``);
        }
      }
      lines.push(`## Short answers`, ``);
      const ans = gen.answers ?? {};
      for (const [k, v] of Object.entries(ans)) {
        lines.push(`### ${k}`, ``, v, ``);
      }
      if (gen.warnings?.length) {
        lines.push(`## Warnings`, ``);
        for (const w of gen.warnings) lines.push(`- ${w}`);
      }
    }

    lines.push(`## Notes`, ``, app.notes?.trim() || '_None._', ``);

    const md = lines.join('\n');
    const safe = `${app.company}-${app.title}`
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'application';

    return new NextResponse(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safe}.md"`,
      },
    });
  } catch (e) {
    console.error('export-md error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export failed' },
      { status: 500 }
    );
  }
}
