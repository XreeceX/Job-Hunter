'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UploadDetail } from '@/components/dashboard';

interface CompanyTableProps {
  upload: UploadDetail;
  selectedRowIds: Set<string>;
  onToggleRow: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const DISPLAY_KEYS = ['company_name', 'role', 'email', 'contact_name', 'notes'];

export function CompanyTable({
  upload,
  selectedRowIds,
  onToggleRow,
  onSelectAll,
  onClearSelection,
}: CompanyTableProps) {
  const keys = upload.columnMappings
    .map((m) => m.semanticKey)
    .filter((k) => k !== 'other');
  const cols = Array.from(new Set([...DISPLAY_KEYS.filter((k) => keys.includes(k)), ...keys]));
  const rows = upload.rows.slice(0, 50);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Companies</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)]">
              <tr>
                <th className="w-8 p-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id))}
                    onChange={(e) => (e.target.checked ? onSelectAll() : onClearSelection())}
                    className="rounded border-[var(--border)]"
                  />
                </th>
                {cols.map((key) => (
                  <th key={key} className="p-2 font-medium text-[var(--muted)]">
                    {key.replace(/_/g, ' ')}
                  </th>
                ))}
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
                    {cols.map((key) => (
                      <td key={key} className="max-w-[180px] truncate p-2" title={String(data[key] ?? '')}>
                        {String(data[key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {upload.rowCount > 50 && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Showing first 50 of {upload.rowCount} rows
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Select one or more companies, then enter a request below.
        </p>
      </CardContent>
    </Card>
  );
}
