/**
 * GET /api/usage/events
 *
 * Returns recent query events for the specified time window.
 *
 * Query parameters:
 *   - window: '24h' | '7d' (required)
 *   - workspaceId: string (optional, filter by workspace)
 *   - limit: number (optional, default 50, max 100)
 *   - offset: number (optional, default 0, for pagination)
 *
 * Response:
 *   - events: array of QueryEvent objects
 *   - total: total count for pagination
 *   - limit: applied limit
 *   - offset: applied offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validationError, internalError } from '@/lib/http';

export const runtime = 'nodejs';

/** Valid time windows */
type TimeWindow = '24h' | '7d';

/** Get the start date for the given window */
function getStartDate(window: TimeWindow): Date {
  const now = new Date();
  if (window === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  // 7d
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window = searchParams.get('window') as TimeWindow | null;
    const workspaceId = searchParams.get('workspaceId');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate window parameter
    if (!window || !['24h', '7d'].includes(window)) {
      return validationError("window parameter is required and must be '24h' or '7d'");
    }

    // Parse and validate limit
    let limit = 50;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        return validationError('limit must be a number between 1 and 100');
      }
      limit = parsed;
    }

    // Parse and validate offset
    let offset = 0;
    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (isNaN(parsed) || parsed < 0) {
        return validationError('offset must be a non-negative number');
      }
      offset = parsed;
    }

    const startDate = getStartDate(window);

    // Build where clause
    const where: {
      createdAt: { gte: Date };
      workspaceId?: string;
    } = {
      createdAt: { gte: startDate },
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Get total count for pagination
    const total = await db.queryEvent.count({ where });

    // Fetch events with pagination
    const events = await db.queryEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        createdAt: true,
        workspaceId: true,
        source: true,
        endpoint: true,
        provider: true,
        model: true,
        mode: true,
        confidence: true,
        corpusScope: true,
        topK: true,
        questionPreview: true,
        questionHash: true,
        questionLength: true,
        latencyMs: true,
        retrievalLatencyMs: true,
        llmLatencyMs: true,
        chunksUsed: true,
        citationsJson: true,
        suggestedRoutesJson: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCostUsd: true,
        errorCode: true,
        errorMessage: true,
      },
    });

    // Fetch workspace names for the events
    const workspaceIds = [...new Set(events.map((e) => e.workspaceId))];
    const workspaces = workspaceIds.length > 0
      ? await db.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, name: true },
        })
      : [];

    const workspaceNameMap = new Map(workspaces.map((w) => [w.id, w.name]));

    // Enrich events with workspace names
    const enrichedEvents = events.map((event) => ({
      ...event,
      workspaceName: workspaceNameMap.get(event.workspaceId) || null,
      // Parse citationsJson if it's a string
      citations: event.citationsJson ?? null,
      suggestedRoutes: event.suggestedRoutesJson ?? null,
    }));

    return NextResponse.json({
      window,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      total,
      limit,
      offset,
      events: enrichedEvents,
    });
  } catch (error) {
    console.error('Usage events error:', error);
    return internalError('Failed to fetch usage events', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
