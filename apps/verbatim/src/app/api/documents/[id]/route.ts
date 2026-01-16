/**
 * Document by ID API
 *
 * GET /api/documents/:id - Get a document with its chunks
 * DELETE /api/documents/:id - Delete a document and its chunks
 *
 * See ARCHITECTURE.md Section 4.3, 4.4, and 13.4.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
}

/**
 * GET /api/documents/:id
 * Returns a document with all its chunks (without embeddings).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing document ID', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Fetch document with chunks
    const document = await db.document.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        chunks: {
          select: {
            id: true,
            content: true,
            headingPath: true,
            anchor: true,
            chunkIndex: true,
            createdAt: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: `Document not found: ${id}`, code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 }
      );
    }

    return NextResponse.json({
      document: {
        id: document.id,
        canonicalId: document.canonicalId,
        corpus: document.corpus,
        route: document.route,
        sourcePath: document.sourcePath,
        title: document.title,
        contentHash: document.contentHash,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        workspace: document.workspace,
        chunks: document.chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          headingPath: chunk.headingPath,
          anchor: chunk.anchor,
          chunkIndex: chunk.chunkIndex,
          createdAt: chunk.createdAt.toISOString(),
        })),
        chunkCount: document.chunks.length,
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id
 * Deletes a document and all its chunks (cascaded via Prisma).
 *
 * Requires workspaceId query param for workspace safety.
 * Returns 403 if document belongs to a different workspace.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing document ID', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Require workspaceId for safety
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required query param: workspaceId', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Fetch document to verify existence and ownership
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        canonicalId: true,
        title: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: `Document not found: ${id}`, code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 }
      );
    }

    // Workspace safety check
    if (document.workspaceId !== workspaceId) {
      return NextResponse.json(
        {
          error: 'Document does not belong to the specified workspace',
          code: 'FORBIDDEN',
        } satisfies ApiError,
        { status: 403 }
      );
    }

    // Delete document (chunks cascade via Prisma onDelete: Cascade)
    await db.document.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      deletedId: document.id,
      workspaceId: document.workspaceId,
      canonicalId: document.canonicalId,
      title: document.title,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}
