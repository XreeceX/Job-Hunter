'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AiDisclaimer } from '@/components/ai-disclaimer';
import { interactiveCardClass } from '@/lib/ui';
import { Loader2, PlugZap } from 'lucide-react';

export default function SettingsPage() {
  const [health, setHealth] = useState<{ ok: boolean; error?: string } | null>(null);
  const [settings, setSettings] = useState<{
    llmProvider: string;
    llmModel: string | null;
    llmConfigured: boolean;
  } | null>(null);
  const [llmTest, setLlmTest] = useState<{ ok: boolean; message?: string; model?: string } | null>(null);
  const [busy, setBusy] = useState<'health' | 'llm' | null>(null);

  useEffect(() => {
    void fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  async function testHealth() {
    setBusy('health');
    setHealth(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth({ ok: Boolean(data.ok), error: data.error });
    } catch (e) {
      setHealth({ ok: false, error: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(null);
    }
  }

  async function testLlm() {
    setBusy('llm');
    setLlmTest(null);
    try {
      const res = await fetch('/api/test-llm', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setLlmTest({ ok: true, model: data.model, message: data.sample });
      } else {
        setLlmTest({ ok: false, message: data.error ?? res.statusText });
      }
    } catch (e) {
      setLlmTest({ ok: false, message: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 text-sm text-[var(--foreground-muted)]">
        LLM provider and API keys are read from environment variables on the server (see README). This page tests
        connectivity only.
      </p>
      <AiDisclaimer className="mb-6" />

      <Card className={interactiveCardClass}>
        <CardHeader>
          <CardTitle className="text-base">Environment (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {settings ? (
            <>
              <p>
                <span className="text-[var(--muted)]">Active provider:</span>{' '}
                <code className="rounded bg-[var(--card-elevated)] px-1.5 py-0.5 font-mono text-xs">
                  {settings.llmProvider}
                </code>
              </p>
              <p>
                <span className="text-[var(--muted)]">Model override:</span>{' '}
                <code className="rounded bg-[var(--card-elevated)] px-1.5 py-0.5 font-mono text-xs">
                  {settings.llmModel ?? '(provider default)'}
                </code>
              </p>
              <p>
                <span className="text-[var(--muted)]">API key present:</span>{' '}
                {settings.llmConfigured ? (
                  <span className="text-emerald-400">yes</span>
                ) : (
                  <span className="text-rose-400">no</span>
                )}
              </p>
            </>
          ) : (
            <p className="text-[var(--muted)]">Could not load settings.</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        <Card className={interactiveCardClass}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Database &amp; server</CardTitle>
            <Button type="button" size="sm" variant="secondary" onClick={testHealth} disabled={busy === 'health'}>
              {busy === 'health' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test /api/health
            </Button>
          </CardHeader>
          <CardContent>
            {health && (
              <p className={`text-sm ${health.ok ? 'text-emerald-400' : 'text-[var(--danger)]'}`}>
                {health.ok ? 'OK — database reachable.' : health.error ?? 'Failed'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={interactiveCardClass}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-4 w-4 text-[var(--accent)]" />
              LLM
            </CardTitle>
            <Button type="button" size="sm" onClick={testLlm} disabled={busy === 'llm'}>
              {busy === 'llm' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test /api/test-llm
            </Button>
          </CardHeader>
          <CardContent>
            {llmTest && (
              <div className="space-y-1 text-sm">
                <p className={llmTest.ok ? 'text-emerald-400' : 'text-[var(--danger)]'}>
                  {llmTest.ok ? `OK — ${llmTest.model ?? 'model responded'}` : llmTest.message}
                </p>
                {llmTest.ok && llmTest.message && (
                  <p className="text-xs text-[var(--foreground-muted)]">Sample: {llmTest.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
