import { runLLM, isLLMConfigured } from '@/lib/services/ai';
import { parseJsonFromLLM } from './json-parse';
import type { GenerationResult, JdAnalysisResult } from './types';
import { analyzeJdOffline, generateOffline } from './offline';

const SYSTEM_CAREER = `You are an experienced career coach helping a candidate prepare application materials.
Rules:
- Do not invent employers, degrees, dates, certifications, or metrics. Only use facts implied or stated in the baseline resume and job description.
- If information is missing, note it in the "warnings" array instead of guessing.
- Output must be valid JSON only, matching the schema requested in the user message.`;

function getModelOverride(): string | undefined {
  const m = process.env.LLM_MODEL?.trim();
  return m || undefined;
}

function logJdSnippet(_label: string, jdText: string) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  // Dev-only: avoid dumping full PII/JD in production logs
  const len = jdText.length;
  console.info(`[job-copilot] JD length=${len}`);
}

export async function analyzeJobDescription(
  jdText: string,
  resumeText: string
): Promise<{ analysis: JdAnalysisResult; offline: boolean }> {
  logJdSnippet('analyze', jdText);
  if (!isLLMConfigured()) {
    return { analysis: analyzeJdOffline(jdText, resumeText), offline: true };
  }

  const user = `Extract structured fields from the job description for tailoring a resume. Use the resume only for context (what the candidate already has), not to invent JD requirements.

Return a JSON object with exactly these keys:
- "required_skills": string array (skills/tools explicitly or clearly required)
- "keywords": string array (important recurring terms for ATS alignment, max 25)
- "seniority_signals": string array (e.g. years, level, leadership — short phrases)
- "summary": string (2-4 sentences summarizing the role)

Job description:
---
${jdText}
---

Candidate resume excerpt (context only, may be truncated):
---
${resumeText.slice(0, 12000)}
---
`;

  const result = await runLLM({
    system: SYSTEM_CAREER,
    user,
    jsonObject: true,
    model: getModelOverride(),
    maxTokens: 2048,
  });

  try {
    const parsed = parseJsonFromLLM<JdAnalysisResult>(result.text);
    if (!Array.isArray(parsed.required_skills)) parsed.required_skills = [];
    if (!Array.isArray(parsed.keywords)) parsed.keywords = [];
    if (!Array.isArray(parsed.seniority_signals)) parsed.seniority_signals = [];
    if (typeof parsed.summary !== 'string') parsed.summary = '';
    return { analysis: parsed, offline: false };
  } catch {
    return { analysis: analyzeJdOffline(jdText, resumeText), offline: true };
  }
}

export async function generateApplicationPack(input: {
  baselineResume: string;
  jdText: string;
  company: string;
  title: string;
}): Promise<{ pack: GenerationResult; offline: boolean }> {
  const { baselineResume, jdText, company, title } = input;
  logJdSnippet('generate', jdText);

  if (!isLLMConfigured()) {
    return {
      pack: generateOffline(jdText, baselineResume, company, title),
      offline: true,
    };
  }

  const user = `Produce tailored application drafts. Baseline resume is the source of truth for experience.

Return a JSON object with exactly these keys:
- "resume_bullet_suggestions": array of objects, each with "original" (verbatim bullet or line from baseline), "suggested" (tailored bullet aligned to JD, truthful), "rationale" (one short sentence)
- "cover_letter": string (short letter; professional; ${company ? `may reference ${company}` : 'company-agnostic unless company name appears in resume context'})
- "short_answers": object mapping question label to draft answer for common fields: "Why this role?", "Salary expectation" (use placeholders where numbers are needed)
- "warnings": string array (missing info, assumptions to verify, or hallucination risks)

Select up to 5 resume lines or bullets to rewrite; prefer strongest overlap with JD.

Company: ${company || '(not specified)'}
Role title: ${title}

Job description:
---
${jdText}
---

Baseline resume:
---
${baselineResume.slice(0, 16000)}
---
`;

  const result = await runLLM({
    system: SYSTEM_CAREER,
    user,
    jsonObject: true,
    model: getModelOverride(),
    maxTokens: 4096,
  });

  try {
    const parsed = parseJsonFromLLM<GenerationResult>(result.text);
    if (!Array.isArray(parsed.resume_bullet_suggestions)) parsed.resume_bullet_suggestions = [];
    if (typeof parsed.cover_letter !== 'string') parsed.cover_letter = '';
    if (!parsed.short_answers || typeof parsed.short_answers !== 'object') parsed.short_answers = {};
    if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
    return { pack: parsed, offline: false };
  } catch {
    return {
      pack: generateOffline(jdText, baselineResume, company, title),
      offline: true,
    };
  }
}
