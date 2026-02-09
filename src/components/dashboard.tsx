'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadZone } from '@/components/upload-zone';
import { AllCompaniesTable, type CompanyRowWithUpload } from '@/components/all-companies-table';
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
  const [allCompanies, setAllCompanies] = useState<CompanyRowWithUpload[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);
  const [uploadMappings, setUploadMappings] = useState<
    Array<{
      uploadId: string;
      headers: string[];
      mappings: Array<{
        columnIndex: number;
        headerName: string;
        semanticKey: string;
      }>;
    }>
  >([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState(false);

  /** Fire a light request in the background to warm serverless; don't block uploads. */
  const warmUpBackground = useCallback(() => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    fetch('/api/health', { signal: c.signal }).catch(() => {}).finally(() => clearTimeout(t));
  }, []);

  const retryDelays = [2000, 5000, 10000]; // ms: retry again after 2s, 5s, 10s

  const fetchUploads = useCallback(
    async (retryIndex?: number) => {
      setUploadsError(null);
      setUploadsLoading(true);
      try {
        warmUpBackground();
        await new Promise((r) => setTimeout(r, 400));
        const res = await fetch('/api/uploads');
        const text = await res.text();

        if (res.status === 401 || res.status === 403) {
          setUploadsError(
            'This deployment requires login (Vercel Deployment Protection). Turn it off: Vercel → Project → Settings → Deployment Protection → disable for Production, or use "Only Preview" so the live app loads data.'
          );
          setUploads([]);
          setUploadsLoading(false);
          return;
        }

        let data: { error?: string; uploads?: UploadSummary[] };
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          setUploadsError(
            "Couldn't load spreadsheets (server returned an error page). Retrying automatically… If it still fails, wait ~15s and click Retry, or check Vercel plan (Hobby = 10s limit)."
          );
          setUploads([]);
          setUploadsLoading(false);
          const next = retryIndex === undefined ? 0 : retryIndex + 1;
          if (next < retryDelays.length) {
            window.setTimeout(() => fetchUploads(next), retryDelays[next]);
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
      } catch (e) {
        setUploadsError(e instanceof Error ? e.message : 'Failed to load uploads');
        setUploads([]);
      } finally {
        setUploadsLoading(false);
      }
    },
    [warmUpBackground]
  );

  const fetchAllCompanies = useCallback(async () => {
    setCompaniesError(null);
    setCompaniesLoading(true);
    try {
      const res = await fetch('/api/companies');
      const text = await res.text();
      let data: {
        error?: string;
        rows?: CompanyRowWithUpload[];
        allColumns?: string[];
        totalRows?: number;
        totalUploads?: number;
        uploadMappings?: Array<{
          uploadId: string;
          headers: string[];
          mappings: Array<{
            columnIndex: number;
            headerName: string;
            semanticKey: string;
          }>;
        }>;
      };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setCompaniesError('Failed to parse response');
        setAllCompanies([]);
        setCompaniesLoading(false);
        return;
      }
      if (!res.ok) {
        setCompaniesError(data?.error ?? 'Failed to load companies');
        setAllCompanies([]);
        return;
      }
      setAllCompanies(data.rows ?? []);
      setAllColumns(data.allColumns ?? []);
      setTotalRows(data.totalRows ?? 0);
      setTotalUploads(data.totalUploads ?? 0);
      setUploadMappings(data.uploadMappings ?? []);
    } catch (e) {
      setCompaniesError(e instanceof Error ? e.message : 'Failed to load companies');
      setAllCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
    fetchAllCompanies();
  }, [fetchUploads, fetchAllCompanies]);

  const onUploadDone = () => {
    fetchUploads();
    // Refresh companies after a short delay to allow DB write to complete
    setTimeout(() => {
      fetchAllCompanies();
    }, 500);
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
    if (allCompanies.length === 0) return;
    const all = new Set(allCompanies.map((r) => r.id));
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
        <div className="lg:col-span-8 space-y-4">
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
                  <div className="text-xs text-[var(--muted)] space-y-1">
                    {uploads.map((u) => (
                      <div key={u.id} className="flex justify-between">
                        <span className="truncate">{u.fileName}</span>
                        <span className="ml-2">{u.rowCount} rows</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!uploadsLoading && !uploadsError && uploads.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  No spreadsheets yet. Upload one above — they’re stored in your database.
                </p>
              )}
            </CardContent>
          </Card>

          {companiesLoading && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-[var(--muted)]">Loading companies…</p>
              </CardContent>
            </Card>
          )}
          {companiesError && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-red-400" role="alert">{companiesError}</p>
                <Button variant="secondary" size="sm" onClick={fetchAllCompanies} className="mt-2">
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}
          {!companiesLoading && !companiesError && (
            <AllCompaniesTable
              rows={allCompanies}
              allColumns={allColumns}
              selectedRowIds={selectedRowIds}
              onToggleRow={toggleRow}
              onSelectAll={selectAllRows}
              onClearSelection={clearSelection}
              totalRows={totalRows}
              totalUploads={totalUploads}
              uploadMappings={uploadMappings}
            />
          )}
        </div>

        <div className="lg:col-span-4">
          <PromptPanel
            selectedCompanyIds={Array.from(selectedRowIds)}
            selectedUploadId={uploads.length > 0 ? uploads[0].id : null}
          />
        </div>
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
