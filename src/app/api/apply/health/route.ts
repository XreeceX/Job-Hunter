import { NextResponse } from 'next/server';
import { isLLMConfigured } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/apply',
    llmConfigured: isLLMConfigured(),
  });
}
