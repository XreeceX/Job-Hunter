'use client';

import { useState, type ClipboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { interactiveCardClass } from '@/lib/ui';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';

interface PromptPanelProps {
  selectedCompanyIds: string[];
  selectedUploadId: string | null;
}

const INTENT_OPTIONS = [
  { value: '', label: 'Custom' },
  { value: 'cold_email', label: 'Cold email' },
  { value: 'cover_letter', label: 'Cover letter' },
  { value: 'research', label: 'Research company' },
  { value: 'interview_qa', label: 'Interview Q&A' },
];

const MAX_PASTED_IMAGES = 5;
const MAX_PASTED_IMAGE_BYTES = 4 * 1024 * 1024;

interface PastedImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read pasted image.'));
    reader.readAsDataURL(file);
  });
}

export function PromptPanel({ selectedCompanyIds, selectedUploadId }: PromptPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [intentHint, setIntentHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [sameCompanyCheck, setSameCompanyCheck] = useState(false);
  const [attachments, setAttachments] = useState<PastedImageAttachment[]>([]);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePromptPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (imageFiles.length === 0) return;
    e.preventDefault();
    setError(null);

    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setPrompt((prev) => (prev ? `${prev}\n${pastedText}` : pastedText));
    }

    const slotsLeft = MAX_PASTED_IMAGES - attachments.length;
    if (slotsLeft <= 0) {
      setError(`You can attach up to ${MAX_PASTED_IMAGES} pasted images.`);
      return;
    }

    const filesToRead = imageFiles.slice(0, slotsLeft);
    const newAttachments: PastedImageAttachment[] = [];

    for (const file of filesToRead) {
      if (file.size > MAX_PASTED_IMAGE_BYTES) {
        setError(`"${file.name}" is too large. Max image size is 4MB.`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name || 'pasted-image',
          mimeType: file.type || 'image/png',
          dataUrl,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not process pasted image.');
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const generate = async () => {
    if (!prompt.trim() && attachments.length === 0) {
      setError('Enter a request or paste an image.');
      return;
    }
    setError(null);
    setLoading(true);
    setOutput('');
    setFollowUpQuestion(null);
    setFollowUpAnswer('');
    setSameCompanyCheck(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyRowIds: selectedCompanyIds,
          userPrompt: prompt.trim(),
          intentHint: intentHint || undefined,
          attachments: attachments.map((item) => ({
            dataUrl: item.dataUrl,
            mimeType: item.mimeType,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (data.needsUserInput && data.question) {
        setFollowUpQuestion(data.question);
        setSameCompanyCheck(data.sameCompanyCheck === true);
        return;
      }
      setOutput(data.text ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const confirmSameCompany = async () => {
    setError(null);
    setLoading(true);
    setOutput('');
    setFollowUpQuestion(null);
    setSameCompanyCheck(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyRowIds: selectedCompanyIds,
          userPrompt: prompt.trim(),
          intentHint: intentHint || undefined,
          sameCompanyConfirmed: true,
          attachments: attachments.map((item) => ({
            dataUrl: item.dataUrl,
            mimeType: item.mimeType,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutput(data.text ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const submitFollowUpAnswer = async () => {
    if (!followUpQuestion || !followUpAnswer.trim()) {
      setError('Please answer the follow-up question.');
      return;
    }
    setError(null);
    setLoading(true);
    setOutput('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyRowIds: selectedCompanyIds,
          userPrompt: prompt.trim(),
          intentHint: intentHint || undefined,
          followUpAnswers: [{ question: followUpQuestion, answer: followUpAnswer.trim() }],
          attachments: attachments.map((item) => ({
            dataUrl: item.dataUrl,
            mimeType: item.mimeType,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutput(data.text ?? '');
      setFollowUpQuestion(null);
      setFollowUpAnswer('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn(interactiveCardClass)}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          AI assistant
        </CardTitle>
        <p className="text-xs text-[var(--muted)]">
          Uses selected rows + your profile. Paste screenshots for extra context.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[var(--foreground-muted)]">Intent (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {INTENT_OPTIONS.map((o) => {
              const active = intentHint === o.value;
              return (
                <button
                  key={o.value || 'custom'}
                  type="button"
                  onClick={() => setIntentHint(o.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.97] motion-reduce:active:scale-100 ${
                    active
                      ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_rgba(134,239,172,0.12)]'
                      : 'border-transparent bg-[var(--card-elevated)] text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[var(--foreground-muted)]">Your request</Label>
          <textarea
            className="input-surface min-h-[120px] resize-y"
            placeholder="Describe what you need — paste job descriptions, bullets, or images with Ctrl+V."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePromptPaste}
            disabled={loading}
          />
          <p className="text-xs text-[var(--muted)]">Ctrl+V: text, screenshots, and copied images (up to 5).</p>
          {attachments.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]/50 p-2 shadow-inner shadow-black/20"
                >
                  <img src={item.dataUrl} alt={item.name} className="max-h-36 w-full rounded-lg object-contain" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-[var(--muted)]">{item.name}</p>
                    <Button variant="ghost" size="sm" onClick={() => removeAttachment(item.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={generate}
          disabled={loading || (!prompt.trim() && attachments.length === 0)}
          className="w-full gap-2 shadow-glow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate
            </>
          )}
        </Button>
        {selectedCompanyIds.length > 0 && (
          <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-elevated)]/50 px-3 py-2 text-xs text-[var(--foreground-muted)]">
            Context: <span className="font-medium text-[var(--foreground)]">{selectedCompanyIds.length}</span>{' '}
            row{selectedCompanyIds.length === 1 ? '' : 's'} selected. Clear the table selection if the question is not about those companies.
          </p>
        )}
        {!selectedUploadId && (
          <p className="text-xs text-[var(--muted)]">
            Upload a spreadsheet and select companies for personalized output.
          </p>
        )}
        {selectedUploadId && selectedCompanyIds.length === 0 && (
          <p className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
            Select one or more companies in the table below, then generate.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {followUpQuestion && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]/60 p-4 shadow-inner shadow-black/20">
            {sameCompanyCheck ? (
              <>
                <Label>Is this for the same company/role as before?</Label>
                <p className="text-xs text-[var(--muted)]">If yes, we&apos;ll use your existing context. If no, we&apos;ll ask for more details.</p>
                <div className="flex gap-2">
                  <Button onClick={confirmSameCompany} disabled={loading} variant="default">
                    Yes, same company
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setSameCompanyCheck(false)}
                    disabled={loading}
                  >
                    No, different company
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Label>AI needs one more detail</Label>
                <p className="text-sm text-[var(--muted)]">{followUpQuestion}</p>
                <textarea
                  className="input-surface min-h-[88px] resize-y"
                  placeholder="Your answer (this will be saved for future applications)"
                  value={followUpAnswer}
                  onChange={(e) => setFollowUpAnswer(e.target.value)}
                  disabled={loading}
                />
                <Button
                  onClick={submitFollowUpAnswer}
                  disabled={loading || !followUpAnswer.trim()}
                  className="w-full"
                >
                  {loading ? 'Submitting…' : 'Submit answer and continue'}
                </Button>
              </>
            )}
          </div>
        )}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[var(--foreground-muted)]">Output</Label>
              <Button variant="outline" size="sm" onClick={copyOutput} className="gap-1.5">
                {copied ? <Check className="h-4 w-4 text-[var(--accent)]" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="min-h-[140px] rounded-xl border border-[var(--border-subtle)] bg-[var(--background)]/80 p-4 font-mono text-sm leading-relaxed text-[var(--foreground-muted)] shadow-inner shadow-black/30 whitespace-pre-wrap [font-variant-ligatures:none]">
              {output}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
