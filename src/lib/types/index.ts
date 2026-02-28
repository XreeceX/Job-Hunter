/**
 * Shared types for job hunter app.
 * No hardcoded column names; semantic keys are inferred at runtime.
 */

/** Semantic keys we infer for columns (used in mapping and CompanyRow.data) */
export const SEMANTIC_KEYS = [
  'company_name',
  'website',
  'email',
  'phone',
  'role',
  'contact_name',
  'notes',
  'other',
] as const;

export type SemanticKey = (typeof SEMANTIC_KEYS)[number];

export interface ColumnInference {
  columnIndex: number;
  headerName: string;
  semanticKey: SemanticKey;
  confidence: number;
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[]; // key = original header, value = cell value
  rowCount: number;
}

/** After mapping: each row is keyed by semantic key */
export interface MappedRow {
  [key: string]: string | null | undefined;
}

export interface UserProfileInput {
  name?: string | null;
  targetRole?: string | null;
  experienceSummary?: string | null;
  skills?: string | null;
  resumeText?: string | null;
  coverLetter?: string | null;
  customQa?: Array<{ question: string; answer: string }> | null;
  preferences?: string | null;
}

export interface GenerateInput {
  companyRowIds: string[];
  userPrompt: string;
  intentHint?: string; // cold_email | cover_letter | research | interview_qa | custom
}

export interface AIGenerateResult {
  text: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}
