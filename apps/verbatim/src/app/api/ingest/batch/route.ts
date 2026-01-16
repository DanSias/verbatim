/**
 * POST /api/ingest/batch
 *
 * Batch ingestion endpoint for docs and KB corpora.
 * See ARCHITECTURE.md Section 6.4.
 *
 * Request: multipart/form-data with workspaceId, corpus, and files
 * Response: IngestBatchResponse
 *
 * Implements:
 * - Route-first canonical identity for docs (Section 4.3)
 * - Path-first canonical identity for KB (Section 6.3)
 * - H2-based chunking (Section 8)
 * - Re-ingestion with content hash (Section 6.5)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { IngestBatchResponse, IngestFileResult, ApiError } from '@verbatim/contracts';
import { db } from '@/lib/db';
import {
  // Docs corpus
  parseMdx,
  extractTitle,
  deriveRoute,
  buildCanonicalId,
  deriveTitle,
  isValidDocsPage,
  chunkDocsContent,
  // KB corpus
  parseMarkdown,
  extractMarkdownTitle,
  buildKbCanonicalId,
  isValidKbArticle,
  deriveKbTitle,
  chunkKbContent,
  // Shared
  computeContentHash,
  DEFAULT_CHUNKING_CONFIG,
} from '@/lib/ingestion';

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

    // Verify workspace exists
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      const error: ApiError = {
        error: `Workspace not found: ${workspaceId}`,
        code: 'NOT_FOUND',
      };
      return NextResponse.json(error, { status: 404 });
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

    // Process each file based on corpus
    const results: IngestFileResult[] = [];
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const file of files) {
      // Route to appropriate processor based on corpus
      const result = corpus === 'docs'
        ? await processDocsFile(file, workspaceId)
        : await processKbFile(file, workspaceId);

      results.push(result);

      switch (result.status) {
        case 'ok':
          totalProcessed++;
          break;
        case 'skipped':
          totalSkipped++;
          break;
        case 'error':
          totalErrors++;
          break;
      }
    }

    const response: IngestBatchResponse = {
      results,
      totalProcessed,
      totalSkipped,
      totalErrors,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Ingestion error:', error);
    const apiError: ApiError = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: { message: error instanceof Error ? error.message : String(error) },
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}

/**
 * Process a single docs file.
 *
 * Identity: route-first (canonicalId = docs:{route})
 * Chunks: H2-based with anchors
 */
async function processDocsFile(
  file: File,
  workspaceId: string
): Promise<IngestFileResult> {
  const filename = file.name;

  try {
    // Validate file is a page.mdx
    if (!isValidDocsPage(filename)) {
      return {
        filename,
        status: 'skipped',
        error: 'Not a page.mdx file',
      };
    }

    // Read file content
    const content = await file.text();

    // Compute content hash for change detection
    const contentHash = computeContentHash(content);

    // Derive route and canonical ID (route-first identity)
    const route = deriveRoute(filename);
    const canonicalId = buildCanonicalId(route);

    // Check if document already exists
    const existingDoc = await db.document.findUnique({
      where: {
        workspaceId_canonicalId: {
          workspaceId,
          canonicalId,
        },
      },
    });

    // Re-ingestion logic: skip if content unchanged
    if (existingDoc && existingDoc.contentHash === contentHash) {
      return {
        filename,
        status: 'skipped',
        canonicalId,
        route,
        error: 'Content unchanged',
      };
    }

    // Parse MDX content
    const parsed = parseMdx(content);

    // Derive title with fallback chain
    const frontmatterTitle = extractTitle(parsed);
    const title = deriveTitle(frontmatterTitle, parsed.firstH1, route);

    // Generate chunks (H2-based with anchors)
    const chunks = chunkDocsContent(
      parsed.normalizedContent,
      parsed.firstH1,
      DEFAULT_CHUNKING_CONFIG
    );

    // Upsert document and chunks in a transaction
    await db.$transaction(async (tx) => {
      if (existingDoc) {
        // Delete existing chunks
        await tx.chunk.deleteMany({
          where: { documentId: existingDoc.id },
        });

        // Update document
        await tx.document.update({
          where: { id: existingDoc.id },
          data: {
            sourcePath: filename,
            title,
            contentHash,
            updatedAt: new Date(),
          },
        });

        // Create new chunks
        await tx.chunk.createMany({
          data: chunks.map((chunk) => ({
            documentId: existingDoc.id,
            content: chunk.content,
            headingPath: chunk.headingPath,
            anchor: chunk.anchor,
            chunkIndex: chunk.chunkIndex,
          })),
        });
      } else {
        // Create new document with chunks
        await tx.document.create({
          data: {
            workspaceId,
            canonicalId,
            corpus: 'docs',
            route,
            sourcePath: filename,
            title,
            contentHash,
            chunks: {
              create: chunks.map((chunk) => ({
                content: chunk.content,
                headingPath: chunk.headingPath,
                anchor: chunk.anchor,
                chunkIndex: chunk.chunkIndex,
              })),
            },
          },
        });
      }
    });

    return {
      filename,
      status: 'ok',
      canonicalId,
      route,
    };
  } catch (error) {
    console.error(`Error processing docs file ${filename}:`, error);
    return {
      filename,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a single KB file.
 *
 * Identity: path-first (canonicalId = kb:{sourcePath})
 * Chunks: H2-based WITHOUT anchors (no navigation links)
 * Route: always null (KB has no routes per ARCHITECTURE.md Section 6.3)
 */
async function processKbFile(
  file: File,
  workspaceId: string
): Promise<IngestFileResult> {
  const filename = file.name;

  try {
    // Validate file is a .md file
    if (!isValidKbArticle(filename)) {
      return {
        filename,
        status: 'skipped',
        error: 'Not a .md file',
      };
    }

    // Read file content
    const content = await file.text();

    // Compute content hash for change detection
    const contentHash = computeContentHash(content);

    // Build canonical ID (path-first identity)
    // KB uses sourcePath as the canonical identity
    const canonicalId = buildKbCanonicalId(filename);

    // Check if document already exists
    const existingDoc = await db.document.findUnique({
      where: {
        workspaceId_canonicalId: {
          workspaceId,
          canonicalId,
        },
      },
    });

    // Re-ingestion logic: skip if content unchanged
    if (existingDoc && existingDoc.contentHash === contentHash) {
      return {
        filename,
        status: 'skipped',
        canonicalId,
        error: 'Content unchanged',
      };
    }

    // Parse Markdown content
    const parsed = parseMarkdown(content);

    // Derive title with fallback chain
    const frontmatterTitle = extractMarkdownTitle(parsed);
    const title = deriveKbTitle(frontmatterTitle, parsed.firstH1, filename);

    // Generate chunks (H2-based WITHOUT anchors)
    const chunks = chunkKbContent(
      parsed.normalizedContent,
      parsed.firstH1,
      DEFAULT_CHUNKING_CONFIG
    );

    // Upsert document and chunks in a transaction
    await db.$transaction(async (tx) => {
      if (existingDoc) {
        // Delete existing chunks
        await tx.chunk.deleteMany({
          where: { documentId: existingDoc.id },
        });

        // Update document
        await tx.document.update({
          where: { id: existingDoc.id },
          data: {
            sourcePath: filename,
            title,
            contentHash,
            updatedAt: new Date(),
          },
        });

        // Create new chunks
        await tx.chunk.createMany({
          data: chunks.map((chunk) => ({
            documentId: existingDoc.id,
            content: chunk.content,
            headingPath: chunk.headingPath,
            anchor: chunk.anchor, // Will be null for KB
            chunkIndex: chunk.chunkIndex,
          })),
        });
      } else {
        // Create new document with chunks
        // NOTE: route is explicitly null for KB (no navigation links)
        await tx.document.create({
          data: {
            workspaceId,
            canonicalId,
            corpus: 'kb',
            route: null, // KB documents have no route
            sourcePath: filename,
            title,
            contentHash,
            chunks: {
              create: chunks.map((chunk) => ({
                content: chunk.content,
                headingPath: chunk.headingPath,
                anchor: chunk.anchor, // Will be null for KB
                chunkIndex: chunk.chunkIndex,
              })),
            },
          },
        });
      }
    });

    return {
      filename,
      status: 'ok',
      canonicalId,
      // No route for KB documents
    };
  } catch (error) {
    console.error(`Error processing KB file ${filename}:`, error);
    return {
      filename,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
