/**
 * POST /api/ingest/batch
 *
 * Batch ingestion endpoint for docs and KB content.
 * See ARCHITECTURE.md Section 6.4.
 *
 * Request: multipart/form-data with workspaceId, corpus, and files
 * Response: IngestBatchResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import type { IngestBatchResponse, ApiError } from '@verbatim/contracts';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const workspaceId = formData.get('workspaceId') as string | null;
    const corpus = formData.get('corpus') as string | null;

    // Validate required fields
    if (!workspaceId || !corpus) {
      const error: ApiError = {
        error: 'Missing required fields: workspaceId, corpus',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(error, { status: 400 });
    }

    if (corpus !== 'docs' && corpus !== 'kb') {
      const error: ApiError = {
        error: 'Invalid corpus: must be "docs" or "kb"',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Get files from form data
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      const error: ApiError = {
        error: 'No files provided',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // TODO: Implement ingestion pipeline
    // 1. Parse each file (MDX/MD)
    // 2. Derive canonicalId and route (for docs)
    // 3. Compute contentHash
    // 4. Upsert document
    // 5. Generate chunks (H2-based)
    // 6. Generate embeddings
    // 7. Store chunks with embeddings

    const response: IngestBatchResponse = {
      results: files.map((file) => ({
        filename: file.name,
        status: 'skipped' as const,
        error: 'Ingestion not implemented',
      })),
      totalProcessed: 0,
      totalSkipped: files.length,
      totalErrors: 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    const apiError: ApiError = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}
