/**
 * POST /api/infer-columns
 * Re-run column inference with optional AI for ambiguous headers.
 * Body: { uploadId: string, useAi?: boolean }
 * Note: Only updates ColumnMapping. CompanyRow.data was keyed at upload time;
 * re-keying would require storing raw rows by header name (not implemented).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  inferColumnsHeuristic,
  inferColumnsWithAI,
} from '@/lib/services/column-inference.service';
import { runLLM, isLLMConfigured } from '@/lib/services/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId, useAi } = body as { uploadId?: string; useAi?: boolean };

    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
    }

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: { columns: { orderBy: { columnIndex: 'asc' } } },
    });

    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const headers = upload.headerRow as string[];
    let inferences = inferColumnsHeuristic(headers);

    if (useAi && isLLMConfigured()) {
      const completionFn = async (prompt: string) => {
        const result = await runLLM({
          system: 'You respond with JSON only, no other text.',
          user: prompt,
          maxTokens: 1024,
        });
        return result.text ?? '[]';
      };
      inferences = await inferColumnsWithAI(headers, completionFn);
    }

    await prisma.columnMapping.deleteMany({ where: { uploadId } });
    await prisma.columnMapping.createMany({
      data: inferences.map((inf) => ({
        uploadId,
        columnIndex: inf.columnIndex,
        headerName: inf.headerName,
        semanticKey: inf.semanticKey,
        confidence: inf.confidence,
      })),
    });

    const mappings = await prisma.columnMapping.findMany({
      where: { uploadId },
      orderBy: { columnIndex: 'asc' },
    });

    return NextResponse.json({
      columnMappings: mappings.map((m) => ({
        columnIndex: m.columnIndex,
        headerName: m.headerName,
        semanticKey: m.semanticKey,
        confidence: m.confidence,
      })),
    });
  } catch (e) {
    console.error('Infer columns error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Inference failed' },
      { status: 500 }
    );
  }
}
