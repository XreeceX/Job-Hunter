/**
 * Prompt Builder Service
 * Builds optimized prompts for the AI from: company row(s), profile, resume, and user request.
 * Template- and intent-aware; no hardcoded column names.
 * Includes serverless-safe size guards: resume truncation, company row limit, character budget.
 */

import type { UserProfile } from '@prisma/client';

export interface PromptContext {
  profile: UserProfile | null;
  companyRows: Array<{ id: string; data: Record<string, unknown> }>;
  userPrompt: string;
  intentHint?: string;
  portfolioContent?: string | null;
  /** When true, user provided image(s)—prioritize image content over other context */
  hasAttachments?: boolean;
}

const SYSTEM_PREFIX = `You are an expert job search assistant. You help the user with personalized, professional content for their job hunt.

Write in a natural human tone:
- Avoid robotic phrasing, filler, and generic buzzwords.
- Use varied sentence length and natural transitions.
- Sound confident and specific, but not stiff or overly formal.
- Prefer concrete examples from the provided context over vague claims.
- Do not invent facts that are not in the context.

Output in the requested format (e.g. email, cover letter, markdown).`;

// Serverless-friendly limits (no tokenizer; character-based soft budget)
const MAX_COMPANY_ROWS = 10;
const MAX_RESUME_CHARS = 3000; // Resume text: keep start (most recent experience first)
const MAX_EXPERIENCE_CHARS = 600;
const MAX_SKILLS_CHARS = 400;
const MAX_QA_ITEMS = 5;
const MAX_PORTFOLIO_CHARS = 4000;
const MAX_USER_MESSAGE_CHARS = 28_000; // ~7k tokens at ~4 chars/token; leaves room for response

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
 * Build profile + resume snippet. Truncates by character; resume uses start (most recent experience first).
 */
function formatProfileContext(profile: UserProfile | null): string {
  if (!profile) return 'No user profile provided.';
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.targetRole) parts.push(`Target role: ${profile.targetRole}`);
  if (profile.experienceSummary) {
    parts.push(`Experience: ${profile.experienceSummary.slice(0, MAX_EXPERIENCE_CHARS)}`);
  }
  if (profile.skills) parts.push(`Skills: ${profile.skills.slice(0, MAX_SKILLS_CHARS)}`);
  if (profile.preferences) parts.push(`Writing preferences: ${profile.preferences.slice(0, 600)}`);
  if (profile.resumeText) {
    parts.push(`Resume (excerpt):\n${profile.resumeText.slice(0, MAX_RESUME_CHARS)}`);
  }
  const qa = profile.customQa as Array<{ question: string; answer: string }> | null;
  if (Array.isArray(qa) && qa.length) {
    parts.push(
      'Custom Q&A: ' +
        qa
          .slice(0, MAX_QA_ITEMS)
          .map((q) => `Q: ${q.question} A: ${q.answer}`)
          .join(' | ')
    );
  }
  return parts.join('\n');
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch portfolio page and return plain text. Used when AI needs more context.
 */
/** Fetches portfolio content. Uses PORTFOLIO_URL from Vercel env (set in Project → Settings → Environment Variables). */
export async function fetchPortfolioContent(_url?: string | null): Promise<string | null> {
  const raw = (process.env.PORTFOLIO_URL ?? '').trim();
  if (!raw) return null;
  let target: string;
  try {
    target = new URL(raw).toString();
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'JobHunter/1.0 (portfolio-context)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtmlToText(html).slice(0, MAX_PORTFOLIO_CHARS);
    return text.length > 0 ? text : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Build full prompt (system + user). Applies row limit and soft character budget for serverless.
 */
export function buildPrompt(ctx: PromptContext): { system: string; user: string } {
  const rowsLimited = ctx.companyRows.slice(0, MAX_COMPANY_ROWS);
  const companyBlocks = rowsLimited.map((row) => formatCompanyContext(row.data));
  const companySection =
    companyBlocks.length === 0
      ? ctx.hasAttachments
        ? 'The user has provided an image—use the image as the primary source for company/role context. Ignore any stale table data.'
        : 'No specific company selected.'
      : companyBlocks.length === 1
        ? `Company:\n${companyBlocks[0]}`
        : `Companies (${companyBlocks.length}):\n${companyBlocks.map((c, i) => `--- Company ${i + 1} ---\n${c}`).join('\n')}`;

  const profileSection = formatProfileContext(ctx.profile);

  const sections: string[] = [
    '## Context',
    '### User profile & resume',
    profileSection,
  ];
  if (ctx.portfolioContent && ctx.portfolioContent.trim().length > 0) {
    sections.push('### Portfolio (additional context)');
    sections.push(ctx.portfolioContent.trim());
  }
  sections.push('### Company/companies', companySection, '## User request', ctx.userPrompt);

  const system = `${SYSTEM_PREFIX}\n\nUse the following context to personalize your response.`;
  let user = sections.join('\n\n');

  if (user.length > MAX_USER_MESSAGE_CHARS) {
    user = user.slice(0, MAX_USER_MESSAGE_CHARS) + '\n\n[Context truncated for length.]';
  }

  return { system, user };
}

/**
 * Intent hints can be used to prepend template-specific instructions.
 */
export function getIntentInstruction(hint?: string): string {
  switch (hint) {
    case 'cold_email':
      return 'Write a short, professional cold email to this company. Keep it warm and direct, and mention the role if provided. Avoid sounding like a template.';
    case 'cover_letter':
      return 'Write a tailored cover letter for this company and role. Use the resume context to highlight relevant experience in a natural, human voice.';
    case 'research':
      return 'Summarize key information about this company and role that would help in an application or interview.';
    case 'interview_qa':
      return 'Answer common interview questions tailored to this role and company, using the user profile and resume. Keep answers clear, natural, and conversational.';
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
