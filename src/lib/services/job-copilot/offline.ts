/**
 * Offline / no-API-key mode: keyword overlap between JD and resume (no invented text).
 */

import type { JdAnalysisResult, GenerationResult, ResumeBulletSuggestion } from './types';

const STOP = new Set(
  'a an the and or for to of in on at by with from as is are was were be been being it its this that these those you we they he she i my our your their will can could should would must may might not'.split(
    ' '
  )
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Simple TF-style scores: term frequency in JD, filtered by overlap with resume. */
export function analyzeJdOffline(jdText: string, resumeText: string): JdAnalysisResult {
  const jdTokens = tokenize(jdText);
  const resumeTokens = new Set(tokenize(resumeText));
  const freq = new Map<string, number>();
  for (const t of jdTokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const scored = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  const keywords = unique(scored.slice(0, 25));
  const required_skills = unique(
    scored.filter((w) => resumeTokens.has(w)).slice(0, 15)
  );
  const seniority_signals = unique(
    ['senior', 'lead', 'principal', 'staff', 'manager', 'director', 'intern', 'junior', 'mid', 'entry'].filter((sig) =>
      jdText.toLowerCase().includes(sig)
    )
  );

  const summary =
    jdText.length > 400 ? `${jdText.slice(0, 400).trim()}…` : jdText.trim() || 'No job description provided.';

  return {
    required_skills: required_skills.length ? required_skills : keywords.slice(0, 10),
    keywords,
    seniority_signals,
    summary,
  };
}

function splitResumeBullets(resumeText: string): string[] {
  return resumeText
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter((l) => l.length > 20)
    .slice(0, 12);
}

export function generateOffline(
  jdText: string,
  resumeText: string,
  company: string,
  roleTitle: string
): GenerationResult {
  const analysis = analyzeJdOffline(jdText, resumeText);
  const topKw = analysis.keywords.slice(0, 8).join(', ');
  const bullets = splitResumeBullets(resumeText);
  const resume_bullet_suggestions: ResumeBulletSuggestion[] = bullets.slice(0, 5).map((original) => ({
    original,
    suggested: original,
    rationale: `Offline mode: align phrasing with JD keywords when editing: ${topKw || '(add keywords from analyze)'}.`,
  }));

  const cover_letter = [
    `Dear Hiring Team,`,
    ``,
    `I am writing to express interest in the ${roleTitle} role${company ? ` at ${company}` : ''}.`,
    `My background matches themes in your posting (see analyzed keywords). Please tailor this draft with specifics from your experience.`,
    ``,
    `Sincerely,`,
    `[Your name]`,
  ].join('\n');

  const short_answers: Record<string, string> = {
    'Why this role?': `I am motivated by the responsibilities and tech stack suggested in the posting. [Add 2–3 concrete reasons from your experience — offline mode did not invent details.]`,
    'Salary expectation': `[Your range or "Open to discussion" — required for accuracy.]`,
  };

  const warnings = [
    'Offline mode: no LLM was used. Outputs are templates and keyword hints only. Set GROQ_API_KEY or OPENAI_API_KEY for AI-assisted tailoring.',
    'Review all facts before submitting; the app does not invent employers, dates, or degrees.',
  ];

  return {
    resume_bullet_suggestions,
    cover_letter,
    short_answers,
    warnings,
  };
}
