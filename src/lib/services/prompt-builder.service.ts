/**
 * Prompt Builder Service
 * Builds optimized prompts for the AI from: company row(s), profile, resume, and user request.
 * Template- and intent-aware; no hardcoded column names.
 */

import type { GenerateInput } from '@/lib/types';
import type { UserProfile, CompanyRow } from '@prisma/client';

export interface PromptContext {
  profile: UserProfile | null;
  companyRows: Array<{ id: string; data: Record<string, unknown> }>;
  userPrompt: string;
  intentHint?: string;
}

const SYSTEM_PREFIX = `You are an expert job search assistant. You help the user with personalized, professional content for their job hunt. Be concise, specific, and use the exact details provided. Output in the requested format (e.g. email, cover letter, markdown).`;

/**
 * Format a single company row (semantic key -> value) as readable context.
 */
function formatCompanyContext(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const order = [
    'company_name',
    'website',
    'role',
    'contact_name',
    'email',
    'phone',
    'notes',
    'other',
  ];
  const seen = new Set<string>();
  for (const key of order) {
    const val = data[key];
    if (val != null && String(val).trim()) {
      lines.push(`${key.replace(/_/g, ' ')}: ${String(val).trim()}`);
      seen.add(key);
    }
  }
  for (const [k, v] of Object.entries(data)) {
    if (seen.has(k)) continue;
    if (v != null && String(v).trim()) {
      lines.push(`${k.replace(/_/g, ' ')}: ${String(v).trim()}`);
    }
  }
  return lines.join('\n');
}

/**
 * Build profile + resume snippet for context (truncate if very long).
 */
function formatProfileContext(profile: UserProfile | null): string {
  if (!profile) return 'No user profile provided.';
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.targetRole) parts.push(`Target role: ${profile.targetRole}`);
  if (profile.experienceSummary) {
    parts.push(`Experience: ${profile.experienceSummary.slice(0, 800)}`);
  }
  if (profile.skills) parts.push(`Skills: ${profile.skills.slice(0, 500)}`);
  if (profile.resumeText) {
    parts.push(`Resume (excerpt):\n${profile.resumeText.slice(0, 2000)}`);
  }
  const qa = profile.customQa as Array<{ question: string; answer: string }> | null;
  if (Array.isArray(qa) && qa.length) {
    parts.push(
      'Custom Q&A: ' +
        qa
          .slice(0, 5)
          .map((q) => `Q: ${q.question} A: ${q.answer}`)
          .join(' | ')
    );
  }
  return parts.join('\n');
}

/**
 * Build full prompt (system + user) for the AI.
 */
export function buildPrompt(ctx: PromptContext): { system: string; user: string } {
  const companyBlocks = ctx.companyRows.map((row) => formatCompanyContext(row.data));
  const companySection =
    companyBlocks.length === 0
      ? 'No specific company selected.'
      : companyBlocks.length === 1
        ? `Company:\n${companyBlocks[0]}`
        : `Companies (${companyBlocks.length}):\n${companyBlocks.map((c, i) => `--- Company ${i + 1} ---\n${c}`).join('\n')}`;

  const profileSection = formatProfileContext(ctx.profile);

  const system = `${SYSTEM_PREFIX}\n\nUse the following context to personalize your response.`;
  const user = [
    '## Context',
    '### User profile & resume',
    profileSection,
    '### Company/companies',
    companySection,
    '## User request',
    ctx.userPrompt,
  ].join('\n\n');

  return { system, user };
}

/**
 * Intent hints can be used to prepend template-specific instructions.
 */
export function getIntentInstruction(hint?: string): string {
  switch (hint) {
    case 'cold_email':
      return 'Write a short, professional cold email to this company. Be direct and mention the role if provided.';
    case 'cover_letter':
      return 'Write a tailored cover letter for this company and role. Use the resume context to highlight relevant experience.';
    case 'research':
      return 'Summarize key information about this company and role that would help in an application or interview.';
    case 'interview_qa':
      return 'Answer common interview questions tailored to this role and company, using the user profile and resume.';
    default:
      return '';
  }
}

/**
 * Build prompt with optional intent-based prepend to user request.
 */
export function buildPromptWithIntent(ctx: PromptContext): { system: string; user: string } {
  const intent = getIntentInstruction(ctx.intentHint);
  const userPrompt = intent ? `${intent}\n\n${ctx.userPrompt}` : ctx.userPrompt;
  return buildPrompt({ ...ctx, userPrompt });
}
