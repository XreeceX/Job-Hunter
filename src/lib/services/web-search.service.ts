/**
 * Live web search for generation context (Tavily or Serper).
 * Fails soft: returns null so generation still works without keys or on API errors.
 */

const MAX_QUERIES = 2;
const MAX_RESULTS_PER_QUERY = 5;
const SNIPPET_CHARS = 420;
const MAX_TOTAL_CONTEXT_CHARS = 4500;

function abortAfterMs(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export interface WebSearchMeta {
  used: boolean;
  provider?: 'tavily' | 'serper';
  queries: string[];
  error?: string;
}

interface NormalizedHit {
  title: string;
  url: string;
  snippet: string;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

function companyNameFromRow(data: Record<string, unknown>): string | null {
  const raw = data.company_name ?? data.name ?? data.company;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

/**
 * Build 1–2 focused queries from the user prompt and selected company rows.
 */
export function buildWebSearchQueries(
  userPrompt: string,
  companyRows: Array<{ data: Record<string, unknown> }>
): string[] {
  const prompt = userPrompt.replace(/\s+/g, ' ').trim();
  const firstName = companyRows.length > 0 ? companyNameFromRow(companyRows[0].data) : null;
  const queries: string[] = [];

  if (firstName) {
    queries.push(`${firstName} company products news careers recent`);
  }

  if (prompt.length >= 12) {
    const focus = truncate(prompt, 220);
    if (firstName) {
      queries.push(`${firstName} ${focus}`);
    } else {
      queries.push(focus);
    }
  } else if (!firstName && prompt.length > 0) {
    queries.push(truncate(prompt, 280));
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const q of queries) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(q);
  }
  return unique.slice(0, MAX_QUERIES);
}

function resolveProvider(): 'tavily' | 'serper' | null {
  const prefer = (process.env.WEB_SEARCH_PROVIDER ?? '').trim().toLowerCase();
  const hasTavily = Boolean((process.env.TAVILY_API_KEY ?? '').trim());
  const hasSerper = Boolean((process.env.SERPER_API_KEY ?? '').trim());

  if (prefer === 'tavily' && hasTavily) return 'tavily';
  if (prefer === 'serper' && hasSerper) return 'serper';
  if (hasTavily) return 'tavily';
  if (hasSerper) return 'serper';
  return null;
}

export function isWebSearchConfigured(): boolean {
  return resolveProvider() !== null;
}

function webSearchGloballyEnabled(): boolean {
  const v = (process.env.WEB_SEARCH_ENABLED ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

async function searchTavily(query: string): Promise<{ hits: NormalizedHit[]; answer?: string }> {
  const apiKey = (process.env.TAVILY_API_KEY ?? '').trim();
  if (!apiKey) return { hits: [] };

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      include_answer: true,
      max_results: MAX_RESULTS_PER_QUERY,
    }),
    signal: abortAfterMs(22_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Tavily HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const hits: NormalizedHit[] = (data.results ?? []).map((r) => ({
    title: truncate(String(r.title ?? 'Untitled'), 120),
    url: String(r.url ?? ''),
    snippet: truncate(String(r.content ?? ''), SNIPPET_CHARS),
  }));

  return { hits, answer: data.answer?.trim() };
}

async function searchSerper(query: string): Promise<NormalizedHit[]> {
  const apiKey = (process.env.SERPER_API_KEY ?? '').trim();
  if (!apiKey) return [];

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: MAX_RESULTS_PER_QUERY }),
    signal: abortAfterMs(22_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Serper HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic ?? []).map((r) => ({
    title: truncate(String(r.title ?? 'Untitled'), 120),
    url: String(r.link ?? ''),
    snippet: truncate(String(r.snippet ?? ''), SNIPPET_CHARS),
  }));
}

function mergeHits(batches: NormalizedHit[][]): NormalizedHit[] {
  const seen = new Set<string>();
  const out: NormalizedHit[] = [];
  for (const batch of batches) {
    for (const h of batch) {
      const key = h.url || `${h.title}:${h.snippet.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out;
}

function formatContext(queries: string[], hits: NormalizedHit[], tavilyAnswer?: string): string {
  const lines: string[] = [];
  lines.push('Queries used: ' + queries.map((q) => `"${q}"`).join('; '));
  if (tavilyAnswer) {
    lines.push('');
    lines.push('Summary (from search index):');
    lines.push(truncate(tavilyAnswer, 900));
  }
  lines.push('');
  lines.push('Sources (snippets; verify critical facts):');
  let budget = MAX_TOTAL_CONTEXT_CHARS - lines.join('\n').length - 80;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const block = [
      `${i + 1}. ${h.title}`,
      h.url ? `   URL: ${h.url}` : '',
      `   ${h.snippet}`,
    ]
      .filter(Boolean)
      .join('\n');
    if (budget <= 0) break;
    const take = block.length <= budget ? block : block.slice(0, budget) + '…';
    lines.push(take);
    lines.push('');
    budget -= take.length + 1;
  }
  let text = lines.join('\n').trim();
  if (text.length > MAX_TOTAL_CONTEXT_CHARS) {
    text = text.slice(0, MAX_TOTAL_CONTEXT_CHARS - 20).trimEnd() + '\n…[truncated]';
  }
  return text;
}

/**
 * Runs live search and returns markdown-ish text for the prompt, or null if disabled / empty / error.
 */
export async function fetchWebSearchContext(params: {
  userPrompt: string;
  companyRows: Array<{ data: Record<string, unknown> }>;
}): Promise<{ text: string | null; meta: WebSearchMeta }> {
  const meta: WebSearchMeta = { used: false, queries: [] };

  if (!webSearchGloballyEnabled()) {
    return { text: null, meta };
  }

  const provider = resolveProvider();
  if (!provider) {
    return { text: null, meta };
  }

  const queries = buildWebSearchQueries(params.userPrompt, params.companyRows);
  meta.queries = queries;

  if (queries.length === 0) {
    return { text: null, meta };
  }

  try {
    if (provider === 'tavily') {
      const results = await Promise.all(queries.map((q) => searchTavily(q)));
      const answers = results.map((r) => r.answer).filter(Boolean) as string[];
      const tavilyAnswer = answers.length > 0 ? answers[0] : undefined;
      const hits = mergeHits(results.map((r) => r.hits));
      if (hits.length === 0 && !tavilyAnswer) {
        meta.provider = 'tavily';
        meta.error = 'No results';
        return { text: null, meta };
      }
      const text = formatContext(queries, hits, tavilyAnswer);
      meta.used = true;
      meta.provider = 'tavily';
      return { text, meta };
    }

    const serperBatches = await Promise.all(queries.map((q) => searchSerper(q)));
    const hits = mergeHits(serperBatches);
    if (hits.length === 0) {
      meta.provider = 'serper';
      meta.error = 'No results';
      return { text: null, meta };
    }
    const text = formatContext(queries, hits);
    meta.used = true;
    meta.provider = 'serper';
    return { text, meta };
  } catch (e) {
    meta.error = e instanceof Error ? e.message : 'Search failed';
    return { text: null, meta };
  }
}
