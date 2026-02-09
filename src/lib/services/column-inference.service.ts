/**
 * Column Inference Service
 * Infers semantic meaning of columns using heuristics and optional AI.
 * No hardcoded column names; works with any spreadsheet headers.
 */

import type { SemanticKey } from '@/lib/types';
import { SEMANTIC_KEYS } from '@/lib/types';

export interface ColumnInferenceResult {
  columnIndex: number;
  headerName: string;
  semanticKey: SemanticKey;
  confidence: number;
}

// Heuristic rules: normalized header substrings -> semantic key
const HEURISTIC_RULES: { pattern: RegExp | string; key: SemanticKey }[] = [
  { pattern: /company|organisation|organization|firma|empresa/i, key: 'company_name' },
  { pattern: /website|url|web|site|careers|hiring.*link|link.*(career|hiring)/i, key: 'website' },
  { pattern: /email|e-mail|mail|contact email/i, key: 'email' },
  { pattern: /phone|tel|mobile|cell|number/i, key: 'phone' },
  { pattern: /role|title|position|job|vacancy|opening|typical.*(ai|ml|role)/i, key: 'role' },
  { pattern: /contact|name|recruiter|hr/i, key: 'contact_name' },
  { pattern: /note|comment|remarks|extra|other/i, key: 'notes' },
];

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\b(and|&)\b/g, ' ');
}

/**
 * Infer semantic key for a single header using heuristics only.
 * Returns key and confidence 0–1.
 */
export function inferColumnHeuristic(headerName: string): {
  semanticKey: SemanticKey;
  confidence: number;
} {
  const normalized = normalizeForMatch(headerName);
  if (!normalized) {
    return { semanticKey: 'other', confidence: 0 };
  }

  for (const { pattern, key } of HEURISTIC_RULES) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (regex.test(normalized)) {
      // Stronger match if header is mostly this concept (e.g. "Email" vs "Email 2")
      const confidence = normalized.length <= 15 ? 0.95 : 0.85;
      return { semanticKey: key, confidence };
    }
  }

  // Check for very short headers that might be abbreviations
  if (normalized === 'co' || normalized === 'org') return { semanticKey: 'company_name', confidence: 0.6 };
  if (normalized === 'em' || normalized === 'e') return { semanticKey: 'email', confidence: 0.5 };
  if (normalized === 'ph' || normalized === 'tel') return { semanticKey: 'phone', confidence: 0.7 };
  if (normalized === 'job' || normalized === 'pos') return { semanticKey: 'role', confidence: 0.7 };

  return { semanticKey: 'other', confidence: 0.2 };
}

/**
 * Infer semantic keys for all headers (heuristics only).
 * Each header gets one semantic key; "other" for unclear.
 */
export function inferColumnsHeuristic(headers: string[]): ColumnInferenceResult[] {
  const used = new Set<SemanticKey>();
  const results: ColumnInferenceResult[] = headers.map((headerName, columnIndex) => {
    const { semanticKey, confidence } = inferColumnHeuristic(headerName);
    // Prefer unique mapping: if key already used, downgrade to 'other' for duplicates
    const key = used.has(semanticKey) && semanticKey !== 'other' ? 'other' : semanticKey;
    if (key !== 'other') used.add(key);
    return {
      columnIndex,
      headerName,
      semanticKey: key,
      confidence,
    };
  });
  return results;
}

/**
 * Optional: use AI to classify ambiguous headers.
 * completionFn(prompt) returns raw response text (e.g. from OpenAI). Provider-agnostic.
 */
export async function inferColumnsWithAI(
  headers: string[],
  completionFn: (prompt: string) => Promise<string>
): Promise<ColumnInferenceResult[]> {
  const heuristicResults = inferColumnsHeuristic(headers);
  const ambiguous = heuristicResults.filter((r) => r.confidence < 0.6 || r.semanticKey === 'other');
  if (ambiguous.length === 0) return heuristicResults;

  const prompt = `You are a data classifier. Given spreadsheet column headers, map each to exactly one semantic key.
Semantic keys (use only these): ${SEMANTIC_KEYS.join(', ')}.

Headers to classify (one per line, format "index: header"):
${ambiguous.map((a) => `${a.columnIndex}: ${a.headerName}`).join('\n')}

Respond with a JSON array only, no markdown. Each element: { "columnIndex": number, "semanticKey": "one_of_the_keys" }`;

  try {
    const content = await completionFn(prompt);
    const json = content.replace(/^```\w*\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(json) as { columnIndex: number; semanticKey: string }[];

    const byIndex = new Map(parsed.map((p) => [p.columnIndex, p.semanticKey as SemanticKey]));
    return heuristicResults.map((r) => {
      const aiKey = byIndex.get(r.columnIndex);
      if (aiKey && SEMANTIC_KEYS.includes(aiKey)) {
        return { ...r, semanticKey: aiKey, confidence: 0.9 };
      }
      return r;
    });
  } catch {
    return heuristicResults;
  }
}
