/**
 * Workspace by ID API
 *
 * DELETE /api/workspaces/:id - Delete a workspace
 *
 * Cascades delete to all documents and chunks.
 * See ARCHITECTURE.md Section 4.1.
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
 * DELETE /api/workspaces/:id
 * Deletes a workspace and all associated documents/chunks.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing workspace ID', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 }
      );
    }

    // Check if workspace exists
    const workspace = await db.workspace.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${id}`, code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 }
      );
    }

    // Delete workspace (cascades to documents, chunks, conversations, messages)
    await db.workspace.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        id: workspace.id,
        name: workspace.name,
      },
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }
}
