/**
 * Query Run Logger
 *
 * Logs retrieval queries for analytics and debugging.
 * Non-blocking: failures are logged but don't affect the request.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { SearchResult } from '@/lib/retrieval/citations';

interface LogQueryRunParams {
  workspaceId: string;
  question: string;
  scope: string[]; // ['docs', 'kb']
  topK: number;
  retrievalMode?: 'keyword' | 'vector';
  results: SearchResult[];
}

interface QueryRunResult {
  chunkId: string;
  score: number;
  citationUrl?: string;
  documentId?: string;
  documentTitle?: string;
  anchor?: string | null;
}

/**
 * Log a query run to the database.
 * Non-blocking: catches and logs errors without throwing.
 */
export async function logQueryRun(params: LogQueryRunParams): Promise<void> {
  try {
    const { workspaceId, question, scope, topK, retrievalMode, results } = params;

    // Convert scope array to comma-separated string
    const scopeString = scope.join(',');

    // Shape results for storage (keep it lightweight)
    const resultsJson: QueryRunResult[] = results.map((result) => {
      const base: QueryRunResult = {
        chunkId: result.chunkId,
        score: result.score,
        documentId: result.documentId,
        anchor: null,
      };

      // Safely extract citation data based on corpus type
      // Guard: check citation exists and has expected properties
      if (result.citation) {
        if (result.corpus === 'docs' && 'route' in result.citation && 'url' in result.citation) {
          // DocsCitation: has route, anchor, url
          base.citationUrl = result.citation.url;
          base.anchor = result.citation.anchor;
        } else if (result.corpus === 'kb' && 'sourcePath' in result.citation) {
          // KbCitation: has sourcePath only
          base.citationUrl = result.citation.sourcePath;
        }
      }

      // Extract document title from canonicalId if available
      if (result.canonicalId) {
        const parts = result.canonicalId.split(':');
        if (parts.length === 2) {
          base.documentTitle = parts[1];
        }
      }

      return base;
    });

    // Create query run record
    await db.queryRun.create({
      data: {
        workspaceId,
        question,
        scope: scopeString,
        topK,
        retrievalMode: retrievalMode ?? null,
        resultsJson: resultsJson as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.warn('[QueryRun] Failed to log query run:', error instanceof Error ? error.message : error);
  }
}
