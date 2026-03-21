'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadZone } from '@/components/upload-zone';
import { AllCompaniesTable, type CompanyRowWithUpload } from '@/components/all-companies-table';
import { PromptPanel } from '@/components/prompt-panel';
import { ProfileSheet } from '@/components/profile-sheet';
import { AnimatedNumber } from '@/components/animated-number';
import { CompaniesTableSkeleton } from '@/components/companies-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { interactiveCardClass } from '@/lib/ui';
import { FileSpreadsheet, User, Rows3, Sparkles } from 'lucide-react';

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
  const uploadsRetryCountRef = useRef(0);

  /** Fire a light request in the background to warm serverless; don't block uploads. */
  const warmUpBackground = useCallback(() => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    fetch('/api/health', { signal: c.signal }).catch(() => {}).finally(() => clearTimeout(t));
  }, []);

  const fetchUploads = useCallback(async (isRetry = false) => {
    setUploadsError(null);
    setUploadsLoading(true);
    try {
      if (!isRetry) warmUpBackground(); // Fire-and-forget; don't block
      const res = await fetch('/api/uploads');
      
      if (!res.ok) {
        // Only show error for actual HTTP errors (4xx, 5xx)
        if (res.status === 401 || res.status === 403) {
          setUploadsError(
            'This deployment requires login (Vercel Deployment Protection). Turn it off: Vercel → Project → Settings → Deployment Protection → disable for Production, or use "Only Preview" so the live app loads data.'
          );
        } else {
          const text = await res.text();
          let errorMessage = 'Failed to load uploads';
          try {
            const errorData = text ? JSON.parse(text) : {};
            if (errorData && typeof errorData === 'object' && 'error' in errorData) {
              errorMessage = errorData.error || errorMessage;
            }
          } catch {
            // If we can't parse error, just use generic message
          }
          setUploadsError(errorMessage);
          setUploads([]);
          setUploadsLoading(false);
          // Auto-retry once for 5xx (e.g. cold start)
          if (res.status >= 500 && uploadsRetryCountRef.current < 1) {
            uploadsRetryCountRef.current += 1;
            setTimeout(() => fetchUploads(true), 2000);
          }
        }
        return;
      }

      const text = await res.text();
      let data: { error?: string; uploads?: UploadSummary[] };
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        // If parsing fails but response is OK, assume empty list
        console.warn('Failed to parse uploads response, assuming empty:', e);
        setUploads([]);
        setUploadsLoading(false);
        return;
      }

      // Success - clear any previous errors and set uploads
      setUploadsError(null);
      uploadsRetryCountRef.current = 0;
      const list = data.uploads ?? [];
      setUploads(list);
    } catch (e) {
      console.error('Error fetching uploads:', e);
      setUploadsError(e instanceof Error ? e.message : 'Failed to load uploads');
      setUploads([]);
    } finally {
      setUploadsLoading(false);
    }
  }, [warmUpBackground]);

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

  const handleDeleteRows = useCallback(async (companyRowIds: string[]) => {
    try {
      const res = await fetch('/api/companies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyRowIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete rows');
      }

      // Refresh the companies list after deletion
      await fetchAllCompanies();
      // Also refresh uploads to update row counts
      await fetchUploads();
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }, [fetchAllCompanies, fetchUploads]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <header className="animate-fade-in-up mb-10 flex flex-col gap-6 border-b border-[var(--border-subtle)] pb-8 motion-reduce:animate-none md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--card-elevated)]/80 px-3 py-1 text-xs font-medium text-[var(--muted)] shadow-glow-sm backdrop-blur-sm transition-colors hover:border-[var(--accent)]/25">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--accent)] motion-reduce:animate-none" aria-hidden />
            AI-assisted outreach &amp; applications
          </div>
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
              Job Hunter
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">
              Import roles, map columns once, and generate tailored copy with your resume and profile as context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex min-h-[1.75rem] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-elevated)]/60 px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--foreground-muted)] transition-colors duration-300 hover:border-[var(--accent)]/20">
              <Rows3 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
              {companiesLoading ? (
                <Skeleton className="inline-block h-3.5 w-14" />
              ) : (
                <>
                  <AnimatedNumber value={totalRows} /> <span className="text-[var(--muted)]">rows</span>
                </>
              )}
            </span>
            <span className="inline-flex min-h-[1.75rem] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-elevated)]/60 px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--foreground-muted)] transition-colors duration-300 hover:border-[var(--accent)]/20">
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
              {uploadsLoading ? (
                <Skeleton className="inline-block h-3.5 w-20" />
              ) : (
                <>
                  <AnimatedNumber value={totalUploads} />{' '}
                  <span className="text-[var(--muted)]">{totalUploads === 1 ? 'upload' : 'uploads'}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProfileOpen(true)}
          className="shrink-0 gap-2 self-start transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] motion-reduce:hover:scale-100 md:self-auto"
        >
          <User className="h-4 w-4" />
          Profile &amp; resume
        </Button>
      </header>

      <div className="stagger-children space-y-8">
        {/* Top row: Spreadsheet (1/4) + AI Assistant (3/4) */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3">
          <Card className={interactiveCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                </span>
                Data import
              </CardTitle>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                CSV / Excel with automatic column detection
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <UploadZone onDone={onUploadDone} />
              {uploadsLoading && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)]/40 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                    </span>
                    Syncing uploads…
                  </div>
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              )}
              {uploadsError && uploads.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--danger)]" role="alert">{uploadsError}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => fetchUploads()}>
                      Retry
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUploadsError(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
              {!uploadsLoading && !uploadsError && uploads.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[var(--muted)]">Recent uploads</Label>
                  <div className="text-xs text-[var(--muted)] space-y-1">
                    {uploads.map((u) => (
                      <div
                        key={u.id}
                        className="flex justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--card-elevated)]/80"
                      >
                        <span className="truncate">{u.fileName}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-[var(--foreground-muted)]">{u.rowCount} rows</span>
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
          </div>

          <div className="lg:col-span-9">
            <PromptPanel
              selectedCompanyIds={Array.from(selectedRowIds)}
              selectedUploadId={uploads.length > 0 ? uploads[0].id : null}
            />
          </div>
        </div>

        {/* Bottom row: Companies table (full width) */}
        <div>
          {companiesLoading && <CompaniesTableSkeleton />}
          {companiesError && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-[var(--danger)]" role="alert">{companiesError}</p>
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
              onSelectVisible={(ids) =>
                setSelectedRowIds((prev) => new Set([...prev, ...ids]))
              }
              onClearSelection={clearSelection}
              onDeleteRows={handleDeleteRows}
              totalRows={totalRows}
              totalUploads={totalUploads}
              uploadMappings={uploadMappings}
            />
          )}
        </div>
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
