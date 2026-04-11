export interface JdAnalysisResult {
  required_skills: string[];
  keywords: string[];
  seniority_signals: string[];
  summary: string;
}

export interface ResumeBulletSuggestion {
  original: string;
  suggested: string;
  rationale: string;
}

export interface GenerationResult {
  resume_bullet_suggestions: ResumeBulletSuggestion[];
  cover_letter: string;
  short_answers: Record<string, string>;
  warnings: string[];
}
