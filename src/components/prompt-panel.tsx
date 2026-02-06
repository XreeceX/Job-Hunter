'use client';

import { useState } from 'react';
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

export function PromptPanel({ selectedCompanyIds, selectedUploadId }: PromptPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [intentHint, setIntentHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) {
      setError('Enter a request.');
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
            placeholder="e.g. Create a short cold email to this company. / Write a cover letter. / Summarize this company for an interview."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button
          onClick={generate}
          disabled={loading || !prompt.trim()}
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
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
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
