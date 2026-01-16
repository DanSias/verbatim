/**
 * Workspace Documents API
 *
 * GET /api/workspaces/:id/documents - List documents in a workspace
 *
 * Query params:
 *   - corpus: 'docs' | 'kb' (optional filter)
 *   - search: string (optional title/canonicalId search)
 *
 * See ARCHITECTURE.md Section 4.3.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Corpus } from '@prisma/client';

export const runtime = 'nodejs';

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
}

/**
 * GET /api/workspaces/:id/documents
 * Returns all documents in a workspace with optional filtering.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace ID', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Check if workspace exists
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${workspaceId}`, code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const corpusFilter = searchParams.get('corpus') as Corpus | null;
    const searchQuery = searchParams.get('search')?.trim() || null;

    // Validate corpus filter
    if (corpusFilter && !['docs', 'kb'].includes(corpusFilter)) {
      return NextResponse.json(
        { error: `Invalid corpus: ${corpusFilter}. Must be 'docs' or 'kb'`, code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Build where clause
    const where: {
      workspaceId: string;
      corpus?: Corpus;
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; canonicalId?: { contains: string; mode: 'insensitive' } }>;
    } = {
      workspaceId,
    };

    if (corpusFilter) {
      where.corpus = corpusFilter;
    }

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { canonicalId: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Fetch documents with chunk count
    const documents = await db.document.findMany({
      where,
      select: {
        id: true,
        canonicalId: true,
        corpus: true,
        route: true,
        sourcePath: true,
        title: true,
        contentHash: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include chunkCount at top level
    const transformedDocuments = documents.map((doc) => ({
      id: doc.id,
      canonicalId: doc.canonicalId,
      corpus: doc.corpus,
      route: doc.route,
      sourcePath: doc.sourcePath,
      title: doc.title,
      contentHash: doc.contentHash,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      chunkCount: doc._count.chunks,
    }));

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      documents: transformedDocuments,
      total: transformedDocuments.length,
    });
  } catch (error) {
    console.error('Error fetching workspace documents:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}
