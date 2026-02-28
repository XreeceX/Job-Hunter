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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">Profile &amp; Resume</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded p-1 hover:bg-[var(--border)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Name</Label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label>Target role</Label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.targetRole ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                placeholder="e.g. Software Engineer"
              />
            </div>
            <div className="grid gap-2">
              <Label>Experience summary</Label>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.experienceSummary ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, experienceSummary: e.target.value }))}
                placeholder="Brief experience summary for AI context"
              />
            </div>
            <div className="grid gap-2">
              <Label>Skills</Label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
