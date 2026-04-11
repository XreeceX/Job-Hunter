/**
 * Fetch a public job posting URL and extract title, company, and description text.
 * Many boards block bots or require JavaScript — extraction is best-effort with clear warnings.
 */

import * as cheerio from 'cheerio';

const MAX_BYTES = 2_000_000;
const MAX_JD_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;
const MAX_REDIRECTS = 4;

export interface ParsedJobPosting {
  normalizedUrl: string;
  suggestedCompany: string | null;
  suggestedTitle: string | null;
  jdText: string;
  pageTitle: string | null;
  warnings: string[];
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, ' ').trim();
}

function assertSafePublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new Error('That URL is not allowed');
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new Error('That URL is not allowed');
    }
  }
  return u;
}

function parseJsonLdJobPosting(html: string): { title?: string; company?: string; description?: string } | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  const out: { title?: string; company?: string; description?: string } = {};

  scripts.each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;
    let data: unknown;
    try {
      data = JSON.parse(txt);
    } catch {
      return;
    }
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      const types = n['@type'];
      const typeList = Array.isArray(types) ? types : types ? [types] : [];
      const isJob = typeList.some((t) => t === 'JobPosting');
      if (isJob) {
        if (typeof n.title === 'string' && n.title.trim()) out.title = n.title.trim();
        const org = n.hiringOrganization;
        if (org && typeof org === 'object' && typeof (org as { name?: string }).name === 'string') {
          const name = (org as { name: string }).name.trim();
          if (name) out.company = name;
        } else if (typeof org === 'string' && org.trim()) {
          out.company = org.trim();
        }
        if (typeof n.description === 'string' && n.description.trim()) {
          out.description = n.description.trim();
        }
      }
      if (Array.isArray(n['@graph'])) {
        for (const g of n['@graph']) visit(g);
      }
    };

    if (Array.isArray(data)) {
      for (const item of data) visit(item);
    } else {
      visit(data);
    }
  });

  if (out.title || out.company || out.description) {
    return out;
  }
  return null;
}

function metaContent($: ReturnType<typeof cheerio.load>, sel: string): string | null {
  const v = $(sel).attr('content');
  return v?.trim() || null;
}

function fallbackMainText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();
  const main = $('main, article, [role="main"], .job-description, #job-description').first();
  const text = (main.length ? main : $('body')).text();
  return text.replace(/\s+/g, ' ').trim();
}

function guessFromPageTitle(pageTitle: string): { company: string | null; title: string | null } {
  const t = pageTitle.replace(/\s+/g, ' ').trim();
  if (!t) return { company: null, title: null };
  const at = t.split(/\s+at\s+/i);
  if (at.length === 2) {
    return { title: at[0].trim() || null, company: at[1].split(/[|\-–—]/)[0]?.trim() || null };
  }
  const pipe = t.split(/\s*[|–—-]\s*/);
  if (pipe.length >= 2) {
    return { title: pipe[0].trim() || null, company: pipe[pipe.length - 1].trim() || null };
  }
  return { title: t, company: null };
}

/**
 * Follow redirects manually with a cap (fetch follows redirects but we validate each hop).
 */
async function fetchHtml(url: URL): Promise<string> {
  let current = url;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    assertSafePublicHttpUrl(current.toString());
    const res = await fetch(current.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; JobHunterBot/1.0; +https://github.com) like personal assistant fetch',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect without location');
      current = new URL(loc, current);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Page returned HTTP ${res.status}`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error('Page is too large to import');
    }
    return new TextDecoder('utf-8').decode(buf);
  }
  throw new Error('Too many redirects');
}

export async function fetchJobPostingFromUrl(rawUrl: string): Promise<ParsedJobPosting> {
  const warnings: string[] = [];
  const u = assertSafePublicHttpUrl(rawUrl);
  u.hash = '';
  const normalizedUrl = u.toString();

  let html: string;
  try {
    html = await fetchHtml(u);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch URL';
    throw new Error(msg);
  }

  const $ = cheerio.load(html);
  const pageTitle = $('title').first().text().trim() || null;
  const ogTitle = metaContent($, 'meta[property="og:title"]') || metaContent($, 'meta[name="twitter:title"]');

  const ld = parseJsonLdJobPosting(html);
  let suggestedTitle = ld?.title?.trim() || ogTitle || pageTitle || null;
  let suggestedCompany = ld?.company?.trim() || null;

  let jdText = '';
  if (ld?.description?.trim()) {
    jdText = ld.description.includes('<') ? stripHtml(ld.description) : ld.description.trim();
  } else {
    jdText = fallbackMainText(html);
    warnings.push(
      'No structured job description block found; using visible page text. Trim the box below if navigation/footer noise appears.'
    );
  }

  if (!suggestedCompany || !suggestedTitle) {
    const guess = guessFromPageTitle(ogTitle || pageTitle || suggestedTitle || '');
    if (!suggestedTitle && guess.title) suggestedTitle = guess.title;
    if (!suggestedCompany && guess.company) suggestedCompany = guess.company;
  }

  if (!suggestedTitle && pageTitle) {
    suggestedTitle = pageTitle.split(/[|–—-]/)[0]?.trim() || pageTitle;
  }

  jdText = jdText.slice(0, MAX_JD_CHARS);
  if (jdText.length < 80) {
    warnings.push(
      'Very little text was extracted. The site may require login or block automated access — paste the job description manually.'
    );
  }

  warnings.push(
    'Automated import can be wrong. Always check company name, role title, and JD text before applying.'
  );

  return {
    normalizedUrl,
    suggestedCompany,
    suggestedTitle,
    jdText,
    pageTitle,
    warnings,
  };
}
