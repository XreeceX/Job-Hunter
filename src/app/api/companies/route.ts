/**
 * GET /api/companies
 * Returns all company rows from all uploads, ordered by upload creation date (latest first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/companies
 * Deletes one or more company rows by their IDs
 * Body: { companyRowIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyRowIds } = body;

    if (!Array.isArray(companyRowIds) || companyRowIds.length === 0) {
      return NextResponse.json(
        { error: 'companyRowIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // First, get the upload IDs before deleting
    const rowsToDelete = await prisma.companyRow.findMany({
      where: {
        id: {
          in: companyRowIds,
        },
      },
      select: {
        uploadId: true,
      },
    });

    // Get unique upload IDs that will be affected
    const affectedUploadIds = [...new Set(rowsToDelete.map((r) => r.uploadId))];

    // Delete the company rows
    const result = await prisma.companyRow.deleteMany({
      where: {
        id: {
          in: companyRowIds,
        },
      },
    });

    // Update rowCount for each affected upload (batched in parallel)
    await Promise.all(
      affectedUploadIds.map(async (uploadId) => {
        const remainingCount = await prisma.companyRow.count({
          where: { uploadId },
        });
        return prisma.upload.update({
          where: { id: uploadId },
          data: { rowCount: remainingCount },
        });
      })
    );

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} ${result.count === 1 ? 'row' : 'rows'}`,
    });
  } catch (e) {
    console.error('Companies delete error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete companies' },
      { status: 500 }
    );
  }
}

export interface CompanyRowWithUpload {
  id: string;
  rowIndex: number;
  data: Record<string, unknown>;
  uploadId: string;
  uploadFileName: string;
  uploadCreatedAt: string;
  headerRow: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Get all uploads ordered by creation date (latest first)
    const uploads = await prisma.upload.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rows: {
          orderBy: { rowIndex: 'asc' },
        },
        columns: {
          orderBy: { columnIndex: 'asc' },
        },
      },
    });

    // Flatten all rows from all uploads, preserving upload info
    const allRows: CompanyRowWithUpload[] = [];
    for (const upload of uploads) {
      for (const row of upload.rows) {
        allRows.push({
          id: row.id,
          rowIndex: row.rowIndex,
          data: row.data as Record<string, unknown>,
          uploadId: upload.id,
          uploadFileName: upload.fileName,
          uploadCreatedAt: upload.createdAt.toISOString(),
          headerRow: upload.headerRow as string[],
        });
      }
    }

    // Collect all unique original header names from all uploads (these are the Excel column names)
    const allColumnKeys = new Set<string>();
    for (const upload of uploads) {
      const headers = upload.headerRow as string[];
      headers.forEach((header) => {
        if (header && header.trim()) {
          allColumnKeys.add(header.trim());
        }
      });
    }

    return NextResponse.json({
      rows: allRows,
      totalRows: allRows.length,
      totalUploads: uploads.length,
      allColumns: Array.from(allColumnKeys).sort(),
      // Include column mappings for each upload so frontend can map semantic keys to headers
      uploadMappings: uploads.map((upload) => ({
        uploadId: upload.id,
        headers: upload.headerRow as string[],
        mappings: upload.columns.map((col) => ({
          columnIndex: col.columnIndex,
          headerName: col.headerName,
          semanticKey: col.semanticKey,
        })),
      })),
    });
  } catch (e) {
    console.error('Companies fetch error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}
