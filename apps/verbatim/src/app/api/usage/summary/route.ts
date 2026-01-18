/**
 * GET /api/usage/summary
 *
 * Returns aggregated usage statistics for the specified time window.
 *
 * Query parameters:
 *   - window: '24h' | '7d' (required)
 *   - workspaceId: string (optional, filter by workspace)
 *
 * Response:
 *   - totalRequests: number
 *   - estimatedCostUsd: number
 *   - avgLatencyMs: number
 *   - byConfidence: { high: number, medium: number, low: number }
 *   - byMode: { answer: number, ticket_draft: number }
 *   - byProvider: { [provider: string]: number }
 *   - byWorkspace: { [workspaceId: string]: { name?: string, count: number } }
 *   - tokenStats: { totalInput: number, totalOutput: number }
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

    // Validate window parameter
    if (!window || !['24h', '7d'].includes(window)) {
      return validationError("window parameter is required and must be '24h' or '7d'");
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

    // Fetch all events for the window
    const events = await db.queryEvent.findMany({
      where,
      select: {
        workspaceId: true,
        provider: true,
        model: true,
        mode: true,
        confidence: true,
        latencyMs: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostUsd: true,
        errorCode: true,
      },
    });

    // Calculate aggregates
    let totalRequests = events.length;
    let totalLatencyMs = 0;
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const byConfidence: Record<string, number> = { high: 0, medium: 0, low: 0 };
    const byMode: Record<string, number> = { answer: 0, ticket_draft: 0 };
    const byProvider: Record<string, number> = {};
    const byWorkspaceCount: Record<string, number> = {};
    let errorCount = 0;

    for (const event of events) {
      totalLatencyMs += event.latencyMs;
      totalCostUsd += event.estimatedCostUsd ?? 0;
      totalInputTokens += event.inputTokens ?? 0;
      totalOutputTokens += event.outputTokens ?? 0;

      // Count by confidence
      if (event.confidence in byConfidence) {
        byConfidence[event.confidence]++;
      }

      // Count by mode
      if (event.mode in byMode) {
        byMode[event.mode]++;
      }

      // Count by provider
      byProvider[event.provider] = (byProvider[event.provider] || 0) + 1;

      // Count by workspace
      byWorkspaceCount[event.workspaceId] = (byWorkspaceCount[event.workspaceId] || 0) + 1;

      // Count errors
      if (event.errorCode) {
        errorCount++;
      }
    }

    // Fetch workspace names for the workspaces we found
    const workspaceIds = Object.keys(byWorkspaceCount);
    const workspaces = workspaceIds.length > 0
      ? await db.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, name: true },
        })
      : [];

    const workspaceNameMap = new Map(workspaces.map((w) => [w.id, w.name]));

    // Build byWorkspace response
    const byWorkspace: Record<string, { name?: string; count: number }> = {};
    for (const [wsId, count] of Object.entries(byWorkspaceCount)) {
      byWorkspace[wsId] = {
        name: workspaceNameMap.get(wsId) || undefined,
        count,
      };
    }

    // Calculate averages
    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0;

    return NextResponse.json({
      window,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      totalRequests,
      estimatedCostUsd: Math.round(totalCostUsd * 10000) / 10000, // 4 decimal places
      avgLatencyMs,
      errorCount,
      byConfidence,
      byMode,
      byProvider,
      byWorkspace,
      tokenStats: {
        totalInput: totalInputTokens,
        totalOutput: totalOutputTokens,
      },
    });
  } catch (error) {
    console.error('Usage summary error:', error);
    return internalError('Failed to fetch usage summary', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
