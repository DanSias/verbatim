/**
 * Workspaces API
 *
 * GET /api/workspaces - List all workspaces
 * POST /api/workspaces - Create a new workspace
 *
 * See ARCHITECTURE.md Section 4.1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/** Workspace response shape */
interface WorkspaceResponse {
  id: string;
  name: string;
  createdAt: string;
  documentCount: number;
  chunkCount: number;
}

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
}

/**
 * GET /api/workspaces
 * Returns list of all workspaces.
 */
export async function GET() {
  try {
    const [workspaces, documentCounts, chunkCountsByDocument] = await Promise.all([
      db.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),
      db.document.groupBy({
        by: ['workspaceId'],
        _count: { _all: true },
      }),
      db.chunk.groupBy({
        by: ['documentId'],
        _count: { _all: true },
      }),
    ]);

    const documentCountMap = new Map<string, number>();
    for (const entry of documentCounts) {
      documentCountMap.set(entry.workspaceId, entry._count._all);
    }

    const chunkCountMap = new Map<string, number>();
    if (chunkCountsByDocument.length > 0) {
      const documentIds = chunkCountsByDocument.map((entry) => entry.documentId);
      const documents = await db.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, workspaceId: true },
      });
      const documentWorkspaceMap = new Map(documents.map((doc) => [doc.id, doc.workspaceId]));

      for (const entry of chunkCountsByDocument) {
        const workspaceId = documentWorkspaceMap.get(entry.documentId);
        if (!workspaceId) continue;
        chunkCountMap.set(
          workspaceId,
          (chunkCountMap.get(workspaceId) || 0) + entry._count._all
        );
      }
    }

    const response: WorkspaceResponse[] = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
      documentCount: documentCountMap.get(w.id) || 0,
      chunkCount: chunkCountMap.get(w.id) || 0,
    }));

    return NextResponse.json({ workspaces: response });
  } catch (error) {
    console.error('Error listing workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Creates a new workspace.
 *
 * Request body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate name
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: name', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    const name = body.name.trim();

    if (name.length === 0) {
      return NextResponse.json(
        { error: 'Name cannot be empty', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or less', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Create workspace
    const workspace = await db.workspace.create({
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    const response: WorkspaceResponse = {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt.toISOString(),
      documentCount: 0,
      chunkCount: 0,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Workspace name already exists', code: 'CONFLICT' } satisfies ApiError,
          { status: 409 }
        );
      }
    }

    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}
