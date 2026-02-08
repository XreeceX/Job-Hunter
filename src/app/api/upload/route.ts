/**
 * POST /api/upload
 * Accepts Excel (.xlsx) or CSV file. Parses, infers columns, stores in DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseExcelBuffer, mapRowsToSemantic } from '@/lib/services/excel-ingestion.service';
import { inferColumnsHeuristic } from '@/lib/services/column-inference.service';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Vercel serverless body limit ~4.5MB)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Use .xlsx, .xls, or .csv' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcelBuffer(buffer);

    if (parsed.headers.length === 0 || parsed.rowCount === 0) {
      return NextResponse.json(
        { error: 'No headers or data rows found in file' },
        { status: 400 }
      );
    }

    const inferences = inferColumnsHeuristic(parsed.headers);
    const headerToSemantic = new Map(
      parsed.headers.map((h, i) => {
        const inf = inferences.find((x) => x.columnIndex === i);
        return [h, inf?.semanticKey ?? 'other'];
      })
    );

    const mappedRows = mapRowsToSemantic(parsed.rows, headerToSemantic);

    const upload = await prisma.upload.create({
      data: {
        fileName: file.name,
        rowCount: parsed.rowCount,
        headerRow: parsed.headers,
      },
    });

    await prisma.columnMapping.createMany({
      data: inferences.map((inf) => ({
        uploadId: upload.id,
        columnIndex: inf.columnIndex,
        headerName: inf.headerName,
        semanticKey: inf.semanticKey,
        confidence: inf.confidence,
      })),
    });

    await prisma.companyRow.createMany({
      data: mappedRows.map((row, rowIndex) => ({
        uploadId: upload.id,
        rowIndex,
        data: row as object,
      })),
    });

    const mappings = await prisma.columnMapping.findMany({
      where: { uploadId: upload.id },
      orderBy: { columnIndex: 'asc' },
    });

    return NextResponse.json({
      uploadId: upload.id,
      fileName: upload.fileName,
      rowCount: upload.rowCount,
      headers: parsed.headers,
      columnMappings: mappings.map((m) => ({
        columnIndex: m.columnIndex,
        headerName: m.headerName,
        semanticKey: m.semanticKey,
        confidence: m.confidence,
      })),
    });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
