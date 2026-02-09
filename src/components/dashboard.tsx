'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadZone } from '@/components/upload-zone';
import { CompanyTable } from '@/components/company-table';
import { PromptPanel } from '@/components/prompt-panel';
import { ProfileSheet } from '@/components/profile-sheet';
import { FileSpreadsheet, User } from 'lucide-react';

export interface UploadSummary {
  id: string;
  fileName: string;
  rowCount: number;
  createdAt: string;
}

export interface ColumnMapping {
  columnIndex: number;
  headerName: string;
  semanticKey: string;
  confidence: number | null;
}

export interface CompanyRow {
  id: string;
  rowIndex: number;
  data: Record<string, unknown>;
}

export interface UploadDetail {
  id: string;
  fileName: string;
  rowCount: number;
  headerRow: string[];
  columnMappings: ColumnMapping[];
  rows: CompanyRow[];
}

export function Dashboard() {
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [uploadDetail, setUploadDetail] = useState<UploadDetail | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState(false);

  /** Warm serverless + DB with a light request so GET /api/uploads is more likely to succeed. */
  const warmUp = useCallback(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    return fetch('/api/health', { signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }, []);

  const fetchUploads = useCallback(
    async (isRetry?: boolean) => {
      setUploadsError(null);
      setUploadsLoading(true);
      try {
        await warmUp();
        const res = await fetch('/api/uploads');
        const text = await res.text();
        let data: { error?: string; uploads?: UploadSummary[] };
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          setUploadsError(
            "Couldn't load spreadsheets (server returned an error page). If you use the pooled DB URL, the first request can time out (cold start). Wait a few seconds and click Retry, or open /api/health to test the connection."
          );
          setUploads([]);
          setUploadsLoading(false);
          if (!isRetry) {
            window.setTimeout(() => fetchUploads(true), 2000);
          }
          return;
        }
        if (!res.ok) {
          setUploadsError(data?.error ?? 'Failed to load uploads');
          setUploads([]);
          return;
        }
        const list = data.uploads ?? [];
        setUploads(list);
        if (list.length > 0 && !selectedUploadId) setSelectedUploadId(list[0].id);
      } catch (e) {
        setUploadsError(e instanceof Error ? e.message : 'Failed to load uploads');
        setUploads([]);
      } finally {
        setUploadsLoading(false);
      }
    },
    [selectedUploadId, warmUp]
  );

  const fetchUploadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/uploads?uploadId=${id}`);
    const text = await res.text();
    let data: { upload?: UploadDetail };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      setUploadDetail(null);
      return;
    }
    if (res.ok && data.upload) {
      setUploadDetail(data.upload);
      setSelectedRowIds(new Set());
    } else {
      setUploadDetail(null);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  useEffect(() => {
    if (selectedUploadId) fetchUploadDetail(selectedUploadId);
    else setUploadDetail(null);
  }, [selectedUploadId, fetchUploadDetail]);

  const onUploadDone = () => {
    fetchUploads();
  };

  const toggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllRows = () => {
    if (!uploadDetail?.rows.length) return;
    const all = new Set(uploadDetail.rows.map((r) => r.id));
    setSelectedRowIds(all);
  };

  const clearSelection = () => setSelectedRowIds(new Set());

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-8 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Job Hunter</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setProfileOpen(true)}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Profile &amp; Resume
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                Spreadsheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <UploadZone onDone={onUploadDone} />
              {uploadsLoading && (
                <p className="text-sm text-[var(--muted)]">Loading spreadsheets…</p>
              )}
              {uploadsError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400" role="alert">{uploadsError}</p>
                  <Button variant="secondary" size="sm" onClick={() => fetchUploads()}>
                    Retry
                  </Button>
                </div>
              )}
              {!uploadsLoading && !uploadsError && uploads.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[var(--muted)]">Recent uploads</Label>
                  <select
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    value={selectedUploadId ?? ''}
                    onChange={(e) => setSelectedUploadId(e.target.value || null)}
                  >
                    {uploads.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fileName} ({u.rowCount} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!uploadsLoading && !uploadsError && uploads.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  No spreadsheets yet. Upload one above — they’re stored in your database.
                </p>
              )}
            </CardContent>
          </Card>

          {uploadDetail && (
            <CompanyTable
              upload={uploadDetail}
              selectedRowIds={selectedRowIds}
              onToggleRow={toggleRow}
              onSelectAll={selectAllRows}
              onClearSelection={clearSelection}
            />
          )}
        </div>

        <div className="lg:col-span-8">
          <PromptPanel
            selectedCompanyIds={Array.from(selectedRowIds)}
            selectedUploadId={selectedUploadId}
          />
        </div>
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
