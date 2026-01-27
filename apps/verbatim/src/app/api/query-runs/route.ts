/**
 * GET /api/query-runs
 *
 * Fetch query run history for analytics and debugging.
 *
 * Query params:
 *   - workspaceId: string (required)
 *   - limit?: number (default 50, max 200)
 *   - scope?: string (optional filter: "docs" | "kb" | "docs,kb")
 *
 * Response:
 *   - runs: QueryRun[] (ordered by createdAt desc)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Response shape */
interface QueryRunsResponse {
  runs: Array<{
    id: string;
    workspaceId: string;
    question: string;
    scope: string;
    topK: number;
    retrievalMode: string | null;
    resultsJson: unknown;
    createdAt: string;
  }>;
}

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const limitParam = searchParams.get('limit');
    const scopeFilter = searchParams.get('scope');

    // Validate required params
    if (!workspaceId) {
      return errorResponse('Missing required query param: workspaceId', 'VALIDATION_ERROR', 400);
    }

    // Parse and validate limit
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), MAX_LIMIT) : DEFAULT_LIMIT;
    if (isNaN(limit) || limit < 1) {
      return errorResponse('Invalid limit parameter', 'VALIDATION_ERROR', 400);
    }

    // Build query
    const where: { workspaceId: string; scope?: string } = { workspaceId };
    if (scopeFilter) {
      where.scope = scopeFilter;
    }

    // Fetch query runs
    const runs = await db.queryRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        workspaceId: true,
        question: true,
        scope: true,
        topK: true,
        retrievalMode: true,
        resultsJson: true,
        createdAt: true,
      },
    });

    const response: QueryRunsResponse = {
      runs: runs.map((run) => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Query runs endpoint error:', error);
    return errorResponse(
      'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
}

/**
 * Build an error response.
 */
function errorResponse(
  message: string,
  code: string,
  status: number
): NextResponse {
  const error: ApiError = { error: message, code };
  return NextResponse.json(error, { status });
}
