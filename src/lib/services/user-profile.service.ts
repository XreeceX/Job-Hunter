/**
 * User Profile Service
 * CRUD for single-user profile, resume storage, and resume text extraction.
 */

import { prisma } from '@/lib/db';
import type { UserProfileInput } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

/** Ensure single user exists; return user id */
async function ensureUser(): Promise<string> {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {},
    });
  }
  return user.id;
}

export async function getOrCreateProfile() {
  const userId = await ensureUser();
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    profile = await prisma.userProfile.create({
      data: { userId },
    });
  }
  return profile;
}

export async function updateProfile(input: UserProfileInput) {
  const profile = await getOrCreateProfile();
  return prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      name: input.name ?? profile.name,
      targetRole: input.targetRole ?? profile.targetRole,
      experienceSummary: input.experienceSummary ?? profile.experienceSummary,
      skills: input.skills ?? profile.skills,
      resumeText: input.resumeText ?? profile.resumeText,
      customQa: (input.customQa ?? profile.customQa) as object | undefined,
      preferences: input.preferences ?? profile.preferences,
    },
  });
}

/**
 * Store resume file and optionally extract text.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set (e.g. on Vercel); otherwise local disk.
 */
export async function saveResume(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ path: string; extractedText: string }> {
  const profile = await getOrCreateProfile();
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  let storagePath: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`resumes/${safeName}`, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: mimeType || undefined,
    });
    storagePath = blob.url;
  } else {
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    storagePath = path.join(uploadDir, safeName);
    await fs.writeFile(storagePath, buffer);
  }

  let extractedText = '';
  if (mimeType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      extractedText = (data?.text ?? '').trim();
    } catch {
      extractedText = '';
    }
  } else if (mimeType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
    extractedText = buffer.toString('utf-8').trim();
  }

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      resumeFileName: fileName,
      resumeStoragePath: storagePath,
      resumeText: extractedText || profile.resumeText,
    },
  });

  return { path: storagePath, extractedText };
}
