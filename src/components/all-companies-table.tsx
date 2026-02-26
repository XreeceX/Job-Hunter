'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          All Companies ({totalRows} rows from {totalUploads} {totalUploads === 1 ? 'upload' : 'uploads'})
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={selectAllVisible}>
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
          {selectedRowIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete ({selectedRowIds.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4">
            No companies found. Upload a spreadsheet to get started.
          </p>
        ) : (
          <>
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] z-10">
                  <tr>
                    <th className="w-8 p-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={selectAllVisible}
                        className="rounded border-[var(--border)]"
                      />
                    </th>
                    {displayColumns.map((col) => (
                      <th key={col} className="p-2 font-medium text-[var(--muted)] whitespace-nowrap">
                        {col === 'upload_file' ? 'Source File' : col.replace(/_/g, ' ')}
                      </th>
                    ))}
                    <th className="w-12 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const data = (row.data || {}) as Record<string, unknown>;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/20"
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(row.id)}
                            onChange={() => onToggleRow(row.id)}
                            className="rounded border-[var(--border)]"
                          />
                        </td>
                        <td className="p-2 text-xs text-[var(--muted)] max-w-[120px] truncate" title={row.uploadFileName}>
                          {row.uploadFileName}
                        </td>
                        {allColumns.map((col) => {
                          const displayValue = getValueForHeader(row, col);
                          return (
                            <td
                              key={col}
                              className="max-w-[200px] p-2 truncate"
                              title={displayValue}
                            >
                              {displayValue}
                            </td>
                          );
                        })}
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRow(row.id)}
                            disabled={deletingId === row.id || deleting}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Select one or more companies above, then enter a request in the AI Assistant panel to generate personalized content.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
