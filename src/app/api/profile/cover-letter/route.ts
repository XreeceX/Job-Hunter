/**
 * POST /api/profile/cover-letter
 * Upload cover letter (PDF or text). Extracts text and updates profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveCoverLetter } from '@/lib/services/user-profile.service';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || 'application/octet-stream';
    const { path: storagePath, extractedText } = await saveCoverLetter(
      buffer,
      file.name,
      mime
    );

    return NextResponse.json({
      success: true,
      fileName: file.name,
      extractedLength: extractedText.length,
      message: extractedText.length
        ? 'Cover letter uploaded and text extracted for AI.'
        : 'Cover letter uploaded. Add cover letter text manually if needed.',
    });
  } catch (e) {
    console.error('Cover letter upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Cover letter upload failed' },
      { status: 500 }
    );
  }
}
