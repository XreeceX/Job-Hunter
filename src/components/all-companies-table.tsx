'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { interactiveCardClass } from '@/lib/ui';

export interface CompanyRowWithUpload {
  id: string;
  rowIndex: number;
  data: Record<string, unknown>;
  uploadId: string;
  uploadFileName: string;
  uploadCreatedAt: string;
  headerRow: string[];
}

interface ColumnMapping {
  columnIndex: number;
  headerName: string;
  semanticKey: string;
}

interface UploadMapping {
  uploadId: string;
  headers: string[];
  mappings: ColumnMapping[];
}

interface AllCompaniesTableProps {
  rows: CompanyRowWithUpload[];
  allColumns: string[];
  selectedRowIds: Set<string>;
  onToggleRow: (id: string) => void;
  onSelectAll: () => void;
  onSelectVisible?: (ids: string[]) => void;
  onClearSelection: () => void;
  onDeleteRows: (ids: string[]) => Promise<void>;
  totalRows: number;
  totalUploads: number;
  uploadMappings?: UploadMapping[];
}

export function AllCompaniesTable({
  rows,
  allColumns,
  selectedRowIds,
  onToggleRow,
  onSelectAll,
  onSelectVisible,
  onClearSelection,
  onDeleteRows,
  totalRows,
  totalUploads,
  uploadMappings = [],
}: AllCompaniesTableProps) {
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteSelected = async () => {
    if (selectedRowIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRowIds.size} ${selectedRowIds.size === 1 ? 'row' : 'rows'}?`)) {
      return;
    }
    setDeleting(true);
    try {
      await onDeleteRows(Array.from(selectedRowIds));
      onClearSelection();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete rows. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this row?')) {
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteRows([id]);
      if (selectedRowIds.has(id)) {
        onToggleRow(id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete row. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };
  // Create a map from uploadId to header->semantic key mapping
  const uploadMappingMap = new Map<string, Map<string, string>>();
  uploadMappings.forEach((um) => {
    const headerToSemantic = new Map<string, string>();
    um.mappings.forEach((m) => {
      headerToSemantic.set(m.headerName, m.semanticKey);
    });
    uploadMappingMap.set(um.uploadId, headerToSemantic);
  });

  // Helper to get value for a column header in a row
  const getValueForHeader = (row: CompanyRowWithUpload, headerName: string): string => {
    const mapping = uploadMappingMap.get(row.uploadId);
    if (mapping) {
      const semanticKey = mapping.get(headerName);
      if (semanticKey && row.data[semanticKey] !== undefined) {
        return String(row.data[semanticKey] ?? '');
      }
    }
    // Fallback: try direct header name match
    if (row.data[headerName] !== undefined) {
      return String(row.data[headerName] ?? '');
    }
    return '';
  };
  // Show all columns from all uploads, including upload file name
  const displayColumns = ['upload_file', ...allColumns];

  const selectAllVisible = () => {
    const visibleIds = rows.map((r) => r.id);
    const allSelected = visibleIds.every((id) => selectedRowIds.has(id));
    if (allSelected) {
      onClearSelection();
    } else if (onSelectVisible) {
      onSelectVisible(visibleIds);
    } else {
      visibleIds.forEach((id) => {
        if (!selectedRowIds.has(id)) onToggleRow(id);
      });
    }
  };

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));

  return (
    <Card className={cn(interactiveCardClass)}>
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            Pipeline
          </CardTitle>
          <p className="text-xs text-[var(--muted)]">
            <span className="font-medium tabular-nums text-[var(--foreground-muted)]">{totalRows.toLocaleString()}</span>{' '}
            rows ·{' '}
            <span className="font-medium tabular-nums text-[var(--foreground-muted)]">{totalUploads}</span>{' '}
            {totalUploads === 1 ? 'upload' : 'uploads'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button variant="outline" size="sm" onClick={selectAllVisible}>
            {allVisibleSelected ? 'Deselect page' : 'Select page'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
          {selectedRowIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="border-[var(--danger)]/35 text-[var(--danger)] hover:bg-[var(--danger-muted)]"
            >
              <Trash2 className="h-4 w-4 mr-1" aria-hidden />
              Delete ({selectedRowIds.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-elevated)]/40 py-10 text-center">
            <p className="text-sm text-[var(--muted)]">
              No companies yet. Upload a spreadsheet to populate this table.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
              <div className="max-h-[min(520px,70vh)] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={selectAllVisible}
                          className="h-3.5 w-3.5 rounded border-[var(--border)] bg-[var(--card-elevated)] text-[var(--accent)] focus:ring-[var(--ring)]"
                          aria-label={allVisibleSelected ? 'Deselect all visible rows' : 'Select all visible rows'}
                        />
                      </th>
                      {displayColumns.map((col) => (
                        <th
                          key={col}
                          className="p-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] whitespace-nowrap"
                        >
                          {col === 'upload_file' ? 'Source' : col.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="w-12 p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {rows.map((row, idx) => {
                      const selected = selectedRowIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            selected
                              ? 'bg-[var(--accent-dim)]/25 hover:bg-[var(--accent-dim)]/35'
                              : idx % 2 === 0
                                ? 'bg-transparent hover:bg-[var(--card-elevated)]/50'
                                : 'bg-[var(--card-elevated)]/20 hover:bg-[var(--card-elevated)]/55'
                          }`}
                        >
                          <td className="p-3 align-middle">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => onToggleRow(row.id)}
                              className="h-3.5 w-3.5 rounded border-[var(--border)] bg-[var(--background)] text-[var(--accent)] focus:ring-[var(--ring)]"
                              aria-label="Select row"
                            />
                          </td>
                          <td
                            className="max-w-[140px] p-3 align-middle font-mono text-xs text-[var(--foreground-muted)]"
                            title={row.uploadFileName}
                          >
                            <span className="block truncate">{row.uploadFileName}</span>
                          </td>
                          {allColumns.map((col) => {
                            const displayValue = getValueForHeader(row, col);
                            return (
                              <td
                                key={col}
                                className="max-w-[220px] p-3 align-middle text-[var(--foreground-muted)]"
                                title={displayValue}
                              >
                                <span className="line-clamp-2">{displayValue}</span>
                              </td>
                            );
                          })}
                          <td className="p-3 align-middle">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRow(row.id)}
                              disabled={deletingId === row.id || deleting}
                              className="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[var(--danger-muted)] hover:text-[var(--danger)]"
                              title="Delete row"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
              Select rows for AI context, then use the assistant panel to generate emails, letters, or research notes.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
