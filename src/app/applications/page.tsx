'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AiDisclaimer } from '@/components/ai-disclaimer';
import { interactiveCardClass } from '@/lib/ui';
import { Link2, Loader2, Plus, Search } from 'lucide-react';

type AppRow = {
  id: string;
  company: string;
  title: string;
  status: string;
  appliedDate: string | null;
  updatedAt: string;
};

const STATUSES = ['', 'WISHLIST', 'APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER'] as const;

function statusBadgeClass(s: string) {
  switch (s) {
    case 'OFFER':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
    case 'INTERVIEW':
      return 'bg-sky-500/15 text-sky-200 border-sky-500/30';
    case 'APPLIED':
      return 'bg-violet-500/15 text-violet-200 border-violet-500/30';
    case 'REJECTED':
      return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
    default:
      return 'bg-[var(--card-elevated)] text-[var(--foreground-muted)] border-[var(--border)]';
  }
}

export default function ApplicationsPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('');
  const [creating, setCreating] = useState(false);
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [postingUrl, setPostingUrl] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [jdDraft, setJdDraft] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [fetchingImport, setFetchingImport] = useState(false);
  const [runCopilotAfterOpen, setRunCopilotAfterOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await fetch(`/api/applications?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setRows(data.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload list when status changes; search uses Refresh / Enter
  }, [status]);

  async function fetchJobUrlPreview() {
    const u = importUrl.trim();
    if (u.length < 8) {
      setError('Paste a full job posting link (https://…).');
      return;
    }
    setFetchingImport(true);
    setError(null);
    setImportWarnings([]);
    try {
      const res = await fetch('/api/job-url/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not fetch that URL');
      setPostingUrl(data.normalizedUrl ?? u);
      setCompany((data.suggestedCompany as string)?.trim() || 'Company (edit me)');
      setTitle((data.suggestedTitle as string)?.trim() || 'Role title (edit me)');
      setJdDraft(typeof data.jdText === 'string' ? data.jdText : '');
      setImportWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setFetchingImport(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          title: title.trim(),
          postingUrl: postingUrl.trim() || null,
          jdText: jdDraft.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Create failed');
      const newId = data.application?.id as string | undefined;
      setCompany('');
      setTitle('');
      setPostingUrl('');
      setImportUrl('');
      setJdDraft('');
      setImportWarnings([]);
      await load();
      if (newId) {
        const q = runCopilotAfterOpen ? '?runCopilot=1' : '';
        window.location.href = `/applications/${newId}${q}`;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="max-w-2xl text-sm text-[var(--foreground-muted)]">
          Track roles and run the copilot on each job description. You copy results into employer sites yourself—nothing
          is auto-submitted.
        </p>
        <AiDisclaimer />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Card className={interactiveCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-[var(--accent)]" />
                New application
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreate} className="space-y-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-elevated)]/40 p-3 space-y-2">
                  <Label htmlFor="importUrl" className="text-xs text-[var(--muted)]">
                    Import from job posting URL
                  </Label>
                  <div className="flex gap-2">
                    <input
                      id="importUrl"
                      type="url"
                      className="flex h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://careers.example.com/jobs/…"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 gap-1"
                      disabled={fetchingImport}
                      onClick={() => void fetchJobUrlPreview()}
                    >
                      {fetchingImport ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      Fetch
                    </Button>
                  </div>
                  <p className="text-[11px] leading-snug text-[var(--muted)]">
                    Fills company, role, posting link, and job text when the page allows it. Login-only or heavy
                    JavaScript sites may not work—paste the JD manually if needed.
                  </p>
                  {importWarnings.length > 0 && (
                    <ul className="list-inside list-disc text-[11px] text-amber-200/90">
                      {importWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="company">Company</Label>
                  <input
                    id="company"
                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="title">Role title</Label>
                  <input
                    id="title"
                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="url">Posting URL (optional)</Label>
                  <input
                    id="url"
                    type="url"
                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                    value={postingUrl}
                    onChange={(e) => setPostingUrl(e.target.value)}
                    placeholder="https://"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--foreground-muted)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-[var(--border)]"
                    checked={runCopilotAfterOpen}
                    onChange={(e) => setRunCopilotAfterOpen(e.target.checked)}
                  />
                  <span>
                    After opening, try to run <strong className="text-[var(--foreground)]">Analyze JD</strong> and{' '}
                    <strong className="text-[var(--foreground)]">Generate</strong> using your saved resume (may take a
                    minute; needs an API key in Settings).
                  </span>
                </label>
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? 'Creating…' : 'Create & open'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card className={interactiveCardClass}>
            <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">All applications</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    className="h-9 w-full min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm sm:w-64"
                    placeholder="Search company or title"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && load()}
                  />
                </div>
                <select
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
                >
                  <option value="">All statuses</option>
                  {STATUSES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-3 text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No applications yet. Create one on the left.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--muted)]">
                        <th className="pb-2 pr-3 font-medium">Company</th>
                        <th className="pb-2 pr-3 font-medium">Role</th>
                        <th className="pb-2 pr-3 font-medium">Status</th>
                        <th className="pb-2 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--border-subtle)]/60">
                          <td className="py-2 pr-3">
                            <Link
                              href={`/applications/${r.id}`}
                              className="font-medium text-[var(--accent)] hover:underline"
                            >
                              {r.company}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 text-[var(--foreground-muted)]">{r.title}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(
                                r.status
                              )}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2 tabular-nums text-[var(--foreground-muted)]">
                            {new Date(r.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
