'use client';

import { useState, type ClipboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
        return;
      }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Intent (optional)</Label>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={intentHint}
            onChange={(e) => setIntentHint(e.target.value)}
          >
            {INTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Your request</Label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Type your prompt, then paste text/images with Ctrl+V."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePromptPaste}
            disabled={loading}
          />
          <p className="text-xs text-[var(--muted)]">Supports Ctrl+V for text, screenshots, and copied images.</p>
          {attachments.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {attachments.map((item) => (
                <div key={item.id} className="rounded-lg border border-[var(--border)] p-2">
                  <img src={item.dataUrl} alt={item.name} className="max-h-36 w-full rounded object-contain" />
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
          className="w-full gap-2"
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
          <p className="text-xs text-[var(--muted)]">
            Using {selectedCompanyIds.length} selected company/companies as context.
          </p>
        )}
        {!selectedUploadId && (
          <p className="text-xs text-[var(--muted)]">
            Upload a spreadsheet and select companies for personalized output.
          </p>
        )}
        {selectedUploadId && selectedCompanyIds.length === 0 && (
          <p className="text-xs text-amber-500/90">
            Select one or more companies in the table above, then Generate.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {followUpQuestion && (
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <Label>AI needs one more detail</Label>
            <p className="text-sm text-[var(--muted)]">{followUpQuestion}</p>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
          </div>
        )}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Output</Label>
              <Button variant="ghost" size="sm" onClick={copyOutput} className="gap-1">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="min-h-[120px] rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm whitespace-pre-wrap">
              {output}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
