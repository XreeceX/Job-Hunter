/**
 * Excel Ingestion Service
 * Parses .xlsx and .csv files without assuming any column structure.
 * Returns raw headers and rows keyed by original header names.
 */

import * as XLSX from 'xlsx';
import type { ParsedSheet } from '@/lib/types';

const CSV_MIME = 'text/csv';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_MIME = 'application/vnd.ms-excel';

export const ALLOWED_MIMES = [CSV_MIME, XLSX_MIME, EXCEL_MIME];
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export interface ParseResult {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Normalize header: trim, collapse spaces, empty -> "Column N"
 */
function normalizeHeader(raw: string, index: number): string {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return t || `Column ${index + 1}`;
}

/**
 * Parse buffer (from uploaded file) into headers + rows.
 * First row is always treated as headers. No column names are hardcoded.
 */
export function parseExcelBuffer(buffer: Buffer): ParsedSheet {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellDates: true,
  });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (data.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const rawHeaders = data[0] as unknown[];
  const headers = rawHeaders.map((h, i) => normalizeHeader(String(h ?? ''), i));

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < data.length; i++) {
    const rawRow = data[i] as unknown[];
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      let val = rawRow[j];
      if (val instanceof Date) val = val.toISOString();
      else if (val != null && typeof val === 'object') val = JSON.stringify(val);
      row[h] = val ?? '';
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Parse CSV string (e.g. from FileReader) into same shape.
 */
export function parseCsvString(csvText: string): ParsedSheet {
  const workbook = XLSX.read(csvText, { type: 'string', raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    header: 1,
    defval: '',
  }) as unknown[][];

  if (data.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const rawHeaders = data[0] as unknown[];
  const headers = rawHeaders.map((h, i) => normalizeHeader(String(h ?? ''), i));

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < data.length; i++) {
    const rawRow = data[i] as unknown[];
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      let val = rawRow[j];
      if (val instanceof Date) val = val.toISOString();
      else if (val != null && typeof val === 'object') val = JSON.stringify(val);
      row[h] = val ?? '';
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Convert rows keyed by original header to rows keyed by semantic key
 * using the provided mapping (headerName -> semanticKey).
 */
export function mapRowsToSemantic(
  rows: Record<string, unknown>[],
  headerToSemantic: Map<string, string>
): Record<string, string | null>[] {
  return rows.map((row) => {
    const out: Record<string, string | null> = {};
    for (const [header, semanticKey] of headerToSemantic) {
      const val = row[header];
      out[semanticKey] =
        val === null || val === undefined ? null : String(val).trim() || null;
    }
    return out;
  });
}
