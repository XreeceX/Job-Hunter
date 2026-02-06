/**
 * POST /api/profile/resume
 * Upload resume (PDF or text). Extracts text and updates profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveResume } from '@/lib/services/user-profile.service';

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
    const { path: storagePath, extractedText } = await saveResume(
      buffer,
      file.name,
      mime
    );

    return NextResponse.json({
      success: true,
      fileName: file.name,
      extractedLength: extractedText.length,
      message: extractedText.length
        ? 'Resume uploaded and text extracted for AI.'
        : 'Resume uploaded. Add resume text manually if needed.',
    });
  } catch (e) {
    console.error('Resume upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Resume upload failed' },
      { status: 500 }
    );
  }
}
