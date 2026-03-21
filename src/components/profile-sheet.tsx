'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, X } from 'lucide-react';

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  name?: string | null;
  targetRole?: string | null;
  experienceSummary?: string | null;
  skills?: string | null;
  resumeFileName?: string | null;
  coverLetterFileName?: string | null;
  customQa?: Array<{ question: string; answer: string }> | null;
  preferences?: string | null;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<ProfileData>({});
  const [saving, setSaving] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [coverLetterUploading, setCoverLetterUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch('/api/profile')
        .then((r) => r.json())
        .then((data) => {
          setProfile(data);
          setForm({
            name: data.name ?? '',
            targetRole: data.targetRole ?? '',
            experienceSummary: data.experienceSummary ?? '',
            skills: data.skills ?? '',
            customQa: data.customQa ?? [],
            preferences: data.preferences ?? '',
          });
        })
        .catch(() => setProfile({}));
    }
  }, [open]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setProfile(data);
      setMessage('Profile saved.');
    } catch {
      setMessage('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const onCoverLetterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverLetterUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/cover-letter', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage(data.message ?? 'Cover letter uploaded.');
      setProfile((p) => (p ? { ...p, coverLetterFileName: file.name } : null));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Cover letter upload failed');
    } finally {
      setCoverLetterUploading(false);
      e.target.value = '';
    }
  };

  const onResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/resume', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage(data.message ?? 'Resume uploaded.');
      setProfile((p) => ({ ...p, resumeFileName: file.name }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setResumeUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)]/95 p-6 shadow-glow backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">Profile &amp; resume</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--muted)]">
                Stored locally for this deployment. Used to personalize AI output.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg border border-transparent p-2 text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--card-elevated)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label className="text-[var(--foreground-muted)]">Name</Label>
              <input
                className="input-surface"
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[var(--foreground-muted)]">Target role</Label>
              <input
                className="input-surface"
                value={form.targetRole ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                placeholder="e.g. Software Engineer"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[var(--foreground-muted)]">Experience summary</Label>
              <textarea
                className="input-surface min-h-[88px] resize-y"
                value={form.experienceSummary ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, experienceSummary: e.target.value }))}
                placeholder="Brief experience summary for AI context"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[var(--foreground-muted)]">Skills</Label>
              <input
                className="input-surface"
                value={form.skills ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="Comma-separated or list"
              />
            </div>
            <div className="grid gap-2">
              <Label>Portfolio URL</Label>
              <p className="text-xs text-[var(--muted)]">
                Set <code className="rounded bg-[var(--border)] px-1">PORTFOLIO_URL</code> in Vercel → Project → Settings → Environment Variables. AI fetches it for extra context when generating.
              </p>
            </div>
            {Array.isArray(form.customQa) && form.customQa.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Saved Q&A (from follow-up questions)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-[var(--muted)]">
                    These answers are sent to the AI with every request. Old company names (e.g. Quantinuum) can stick here.
                  </p>
                  <div className="space-y-1 text-xs">
                    {form.customQa.map((qa, i) => (
                      <div key={i} className="rounded border border-[var(--border)] p-2">
                        <p className="font-medium text-[var(--muted)]">Q: {qa.question}</p>
                        <p>A: {qa.answer}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setForm((f) => ({ ...f, customQa: [] }));
                      setSaving(true);
                      setMessage(null);
                      try {
                        const res = await fetch('/api/profile', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...form, customQa: [] }),
                        });
                        if (!res.ok) throw new Error('Failed to clear');
                        const data = await res.json();
                        setProfile(data);
                        setForm((f) => ({ ...f, customQa: [] }));
                        setMessage('Saved Q&A cleared.');
                      } catch {
                        setMessage('Failed to clear.');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Clear saved Q&A
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resume (PDF or text)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile?.resumeFileName && (
                  <p className="text-xs text-[var(--muted)]">Current: {profile.resumeFileName}</p>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--accent)] hover:underline">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={onResumeChange}
                    disabled={resumeUploading}
                  />
                  {resumeUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {resumeUploading ? 'Uploading…' : 'Upload resume'}
                </label>
                <p className="text-xs text-[var(--muted)]">Text is extracted for AI personalization.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cover letter (PDF or text)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile?.coverLetterFileName && (
                  <p className="text-xs text-[var(--muted)]">Current: {profile.coverLetterFileName}</p>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--accent)] hover:underline">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={onCoverLetterChange}
                    disabled={coverLetterUploading}
                  />
                  {coverLetterUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {coverLetterUploading ? 'Uploading…' : 'Upload cover letter'}
                </label>
                <p className="text-xs text-[var(--muted)]">Template or base cover letter. AI will tailor it per request.</p>
              </CardContent>
            </Card>
            {message && (
              <p className="text-sm text-[var(--muted)]">{message}</p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-5">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button onClick={saveProfile} disabled={saving} className="min-w-[7rem] gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
