/**
 * User Profile Service
 * CRUD for single-user profile, resume storage, and resume text extraction.
 */

import { prisma } from '@/lib/db';
import type { UserProfileInput } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

export interface QaItem {
  question: string;
  answer: string;
}

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

function normalizeQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Save user-provided Q&A answers to memory (customQa).
 * Existing questions are updated by normalized text match.
 */
export async function upsertProfileQaItems(items: QaItem[]) {
  if (!items.length) return getOrCreateProfile();

  const profile = await getOrCreateProfile();
  const existing = (profile.customQa as QaItem[] | null) ?? [];
  const map = new Map<string, QaItem>();

  for (const entry of existing) {
    if (!entry?.question || !entry?.answer) continue;
    map.set(normalizeQuestion(entry.question), {
      question: entry.question.trim(),
      answer: entry.answer.trim(),
    });
  }

  for (const entry of items) {
    if (!entry?.question || !entry?.answer) continue;
    const question = entry.question.trim();
    const answer = entry.answer.trim();
    if (!question || !answer) continue;
    map.set(normalizeQuestion(question), { question, answer });
  }

  return prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      customQa: Array.from(map.values()) as object,
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
