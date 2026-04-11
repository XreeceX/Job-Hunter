import { prisma } from '@/lib/db';
import type { ApplicationStatus, JobApplication } from '@prisma/client';

export function serializeJobApplication(row: JobApplication) {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    postingUrl: row.postingUrl,
    status: row.status,
    appliedDate: row.appliedDate?.toISOString() ?? null,
    notes: row.notes,
    jdText: row.jdText,
    jdAnalysis: row.jdAnalysis,
    lastGeneration: row.lastGeneration,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureUserId(): Promise<string> {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({ data: {} });
  }
  return user.id;
}

export interface CreateApplicationInput {
  company: string;
  title: string;
  postingUrl?: string | null;
  status?: ApplicationStatus;
  appliedDate?: Date | null;
  notes?: string | null;
  jdText?: string | null;
}

export interface UpdateApplicationInput {
  company?: string;
  title?: string;
  postingUrl?: string | null;
  status?: ApplicationStatus;
  appliedDate?: Date | null;
  notes?: string | null;
  jdText?: string | null;
  jdAnalysis?: unknown | null;
  lastGeneration?: Record<string, unknown> | null;
}

export async function createApplication(input: CreateApplicationInput): Promise<JobApplication> {
  const userId = await ensureUserId();
  return prisma.jobApplication.create({
    data: {
      userId,
      company: input.company,
      title: input.title,
      postingUrl: input.postingUrl ?? null,
      status: input.status ?? 'WISHLIST',
      appliedDate: input.appliedDate ?? null,
      notes: input.notes ?? null,
      jdText: input.jdText ?? null,
    },
  });
}

export async function listApplications(filters: {
  status?: ApplicationStatus;
  search?: string;
}): Promise<JobApplication[]> {
  const userId = await ensureUserId();
  const search = filters.search?.trim();
  return prisma.jobApplication.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { company: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getApplication(id: string): Promise<JobApplication | null> {
  const userId = await ensureUserId();
  return prisma.jobApplication.findFirst({
    where: { id, userId },
  });
}

export async function deleteApplication(id: string): Promise<boolean> {
  const existing = await getApplication(id);
  if (!existing) return false;
  await prisma.jobApplication.delete({ where: { id } });
  return true;
}

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput
): Promise<JobApplication | null> {
  const existing = await getApplication(id);
  if (!existing) return null;
  return prisma.jobApplication.update({
    where: { id },
    data: {
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.postingUrl !== undefined ? { postingUrl: input.postingUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.appliedDate !== undefined ? { appliedDate: input.appliedDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.jdText !== undefined ? { jdText: input.jdText } : {}),
      ...(input.jdAnalysis !== undefined ? { jdAnalysis: input.jdAnalysis as object } : {}),
      ...(input.lastGeneration !== undefined
        ? { lastGeneration: input.lastGeneration as object }
        : {}),
    },
  });
}
