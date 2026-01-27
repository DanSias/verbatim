/**
 * Workspace Stats API
 *
 * GET /api/workspaces/:id/stats - Get workspace statistics
 *
 * Returns document and chunk counts for routing logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
}

/** Success response shape */
interface StatsResponse {
  workspaceId: string;
  documentsCount: number;
  chunksCount: number;
}

/**
 * GET /api/workspaces/:id/stats
 * Returns document and chunk counts for a workspace.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing workspace ID', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if workspace exists
    const workspace = await db.workspace.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${id}`, code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Count documents in this workspace
    const documentsCount = await db.document.count({
      where: { workspaceId: id },
    });

    // Count chunks in this workspace
    const chunksCount = await db.chunk.count({
      where: {
        document: {
          workspaceId: id,
        },
      },
    });

    const response: StatsResponse = {
      workspaceId: id,
      documentsCount,
      chunksCount,
    };

    return NextResponse.json(response, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching workspace stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
