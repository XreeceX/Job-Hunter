/**
 * Extract and parse JSON from LLM output; repair common issues (markdown fences, trailing text).
 */

export function extractJsonObjectString(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return candidate.slice(start, end + 1);
}

export function parseJsonFromLLM<T = unknown>(raw: string): T {
  const slice = extractJsonObjectString(raw);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // Try trimming to last balanced } if truncated
    const repaired = slice.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(repaired) as T;
  }
}
