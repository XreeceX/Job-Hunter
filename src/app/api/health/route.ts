/**
 * GET /api/health – quick DB connectivity check.
 * Returns JSON so you can tell "DB + server OK" vs "timeout/HTML error page".
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('Health check error:', err.message);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
