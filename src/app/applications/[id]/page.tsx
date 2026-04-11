'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AiDisclaimer } from '@/components/ai-disclaimer';
import { CopyButton } from '@/components/copy-button';
import { interactiveCardClass } from '@/lib/ui';
import { ArrowLeft, Download, Loader2, Save, Sparkles, Wand2 } from 'lucide-react';

type GenPack = {
  resume_bullets?: Array<{ original: string; suggested: string; rationale?: string }>;
  cover_letter?: string;
  answers?: Record<string, string>;
  warnings?: string[];
  offline?: boolean;
};

type AppDetail = {
  id: string;
  company: string;
  title: string;
  postingUrl: string | null;
  status: string;
  appliedDate: string | null;
  notes: string | null;
  jdText: string | null;
  jdAnalysis: unknown;
  lastGeneration: GenPack | null;
  updatedAt: string;
};

const STATUSES = ['WISHLIST', 'APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER'] as const;

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jdText, setJdText] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('WISHLIST');
  const [appliedDate, setAppliedDate] = useState('');

  const [jdAnalysis, setJdAnalysis] = useState<unknown>(null);
  const [analyzeOffline, setAnalyzeOffline] = useState(false);

  const [gen, setGen] = useState<GenPack | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [bullets, setBullets] = useState<Array<{ original: string; suggested: string; rationale?: string }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  const [busy, setBusy] = useState<'analyze' | 'generate' | 'save' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Not found');
      const a = data.application as AppDetail;
      setApp(a);
      setJdText(a.jdText ?? '');
      setNotes(a.notes ?? '');
      setStatus(a.status);
      setAppliedDate(a.appliedDate ? a.appliedDate.slice(0, 10) : '');
      setJdAnalysis(a.jdAnalysis);
      setAnalyzeOffline(false);
      const lg = a.lastGeneration as GenPack | null;
      setGen(lg);
      if (lg) {
        setCoverLetter(lg.cover_letter ?? '');
        setBullets(lg.resume_bullets ?? []);
        setAnswers(lg.answers ?? {});
        setWarnings(lg.warnings ?? []);
      } else {
        setCoverLetter('');
        setBullets([]);
        setAnswers({});
        setWarnings([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta() {
    if (!id) return;
    setBusy('save');
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: notes || null,
          jdText: jdText || null,
          appliedDate: appliedDate ? new Date(appliedDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setApp(data.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveDrafts() {
    if (!id) return;
    setBusy('save');
    setError(null);
    try {
      const lastGeneration: GenPack = {
        resume_bullets: bullets,
        cover_letter: coverLetter,
        answers,
        warnings,
        offline: gen?.offline,
      };
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastGeneration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setApp(data.application);
      setGen(lastGeneration);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (!id || jdText.trim().length < 10) {
      setError('Paste at least a few lines of job description before analyzing.');
      return;
    }
    setBusy('analyze');
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}/analyze-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analyze failed');
      setJdAnalysis(data.jd_analysis);
      setAnalyzeOffline(Boolean(data.offline));
      setApp(data.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyze failed');
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!id) return;
    setBusy('generate');
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generate failed');
      setCoverLetter(data.cover_letter ?? '');
      setBullets(data.resume_bullets ?? []);
      setAnswers(data.answers ?? {});
      setWarnings(data.warnings ?? []);
      setGen({
        resume_bullets: data.resume_bullets,
        cover_letter: data.cover_letter,
        answers: data.answers,
        warnings: data.warnings,
        offline: data.offline,
      });
      setApp(data.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading && !app) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-16 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error && !app) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-[var(--danger)]">{error}</p>
        <Link href="/applications" className="mt-4 inline-block text-[var(--accent)] hover:underline">
          Back to applications
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Applications
        </Link>
      </div>

      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{app?.title}</h1>
        <p className="text-[var(--foreground-muted)]">
          {app?.company}
          {app?.postingUrl && (
            <>
              {' '}
              ·{' '}
              <a href={app.postingUrl} className="text-[var(--accent)] hover:underline" target="_blank" rel="noreferrer">
                Posting
              </a>
            </>
          )}
        </p>
        <AiDisclaimer />
      </div>

      {error && (
        <p className="mb-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-6">
        <Card className={interactiveCardClass}>
          <CardHeader>
            <CardTitle className="text-base">Application meta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Date applied</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <textarea
                className="min-h-[88px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interview dates, contacts, follow-ups…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => saveMeta()} disabled={busy === 'save'}>
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save status &amp; notes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={interactiveCardClass}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Job description</CardTitle>
            <Button type="button" size="sm" onClick={analyze} disabled={busy === 'analyze'}>
              {busy === 'analyze' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze JD
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="min-h-[200px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description from the employer site…"
            />
            {analyzeOffline && (
              <p className="text-xs text-amber-200/80">
                Analysis used offline keyword mode (no API key or parse fallback). Set GROQ_API_KEY or OPENAI_API_KEY for
                LLM extraction.
              </p>
            )}
            {jdAnalysis != null ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-elevated)]/50 p-3 text-sm">
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-[var(--foreground-muted)]">
                  {JSON.stringify(jdAnalysis as object, null, 2)}
                </pre>
                <CopyButton label="Copy analysis JSON" text={JSON.stringify(jdAnalysis, null, 2)} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={interactiveCardClass}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Generate drafts</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={generate} disabled={busy === 'generate'}>
                {busy === 'generate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Generate
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={saveDrafts} disabled={busy === 'save'}>
                <Save className="h-4 w-4" />
                Save edited drafts
              </Button>
              <a href={`/api/applications/${id}/export-md`} download>
                <Button type="button" size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                  Export .md
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm">
                <p className="font-medium text-amber-100/90">Warnings</p>
                <ul className="mt-1 list-inside list-disc text-[var(--foreground-muted)]">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Cover letter</Label>
                <CopyButton text={coverLetter} label="Copy" />
              </div>
              <textarea
                className="min-h-[180px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Resume bullet suggestions</Label>
              {bullets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Run Generate to populate suggestions.</p>
              ) : (
                bullets.map((b, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-elevated)]/40 p-3"
                  >
                    <p className="text-xs font-medium text-[var(--muted)]">Original</p>
                    <textarea
                      className="min-h-[72px] w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-xs"
                      value={b.original}
                      onChange={(e) => {
                        const next = [...bullets];
                        next[idx] = { ...next[idx], original: e.target.value };
                        setBullets(next);
                      }}
                    />
                    <p className="text-xs font-medium text-[var(--muted)]">Suggested</p>
                    <textarea
                      className="min-h-[72px] w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-xs"
                      value={b.suggested}
                      onChange={(e) => {
                        const next = [...bullets];
                        next[idx] = { ...next[idx], suggested: e.target.value };
                        setBullets(next);
                      }}
                    />
                    <div className="flex justify-end">
                      <CopyButton text={b.suggested} label="Copy suggested" />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label>Short answers</Label>
              {Object.keys(answers).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No answers yet. Run Generate.</p>
              ) : (
                Object.entries(answers).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{k}</span>
                      <CopyButton text={v} label="Copy" />
                    </div>
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      value={v}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [k]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
