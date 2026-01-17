/**
 * Shared Retrieval Function
 *
 * Core retrieval logic used by both /api/ask and /api/answer endpoints.
 * This abstraction allows the same retrieval to be used for:
 * - Direct chunk/citation results (/api/ask)
 * - LLM-synthesized answers (/api/answer)
 */

import type { Corpus } from '@prisma/client';
import { db } from '@/lib/db';
import { keywordSearch, type RetrievedChunk } from './keyword-search';
import { toSearchResult, extractSuggestedRoutes, type SearchResult, type SuggestedRoute } from './citations';

/** Options for retrieval */
export interface RetrievalOptions {
  workspaceId: string;
  question: string;
  topK?: number;
  corpusScope?: Corpus[];
}

/** Result from retrieval */
export interface RetrievalResult {
  /** Raw retrieved chunks (for LLM context building) */
  chunks: RetrievedChunk[];
  /** Formatted search results with citations */
  results: SearchResult[];
  /** Suggested docs routes */
  suggestedRoutes: SuggestedRoute[];
  /** Debug information */
  debug: {
    retrievalMode: 'vector' | 'keyword';
    totalChunksScanned: number;
    topK: number;
    corpusScope: string[];
  };
}

/** Default values */
const DEFAULT_TOP_K = 8;
const DEFAULT_CORPUS_SCOPE: Corpus[] = ['docs', 'kb'];
const MAX_SUGGESTED_ROUTES = 5;

/**
 * Perform retrieval and return both raw chunks and formatted results.
 *
 * @param options - Retrieval options
 * @returns Retrieval result with chunks, results, and suggested routes
 * @throws Error if workspace not found
 */
export async function retrieve(options: RetrievalOptions): Promise<RetrievalResult> {
  const {
    workspaceId,
    question,
    topK = DEFAULT_TOP_K,
    corpusScope = DEFAULT_CORPUS_SCOPE,
  } = options;

  // Verify workspace exists
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new RetrievalError(`Workspace not found: ${workspaceId}`, 'NOT_FOUND');
  }

  // Perform keyword-based retrieval
  const chunks = await keywordSearch({
    workspaceId,
    question,
    topK,
    corpusScope,
  });

  // Convert to search results with citations
  const results = chunks.map(toSearchResult);

  // Extract suggested routes from docs results only
  const suggestedRoutes = extractSuggestedRoutes(chunks, MAX_SUGGESTED_ROUTES);

  // Count total chunks for debug info
  const totalChunksScanned = await db.chunk.count({
    where: {
      document: {
        workspaceId,
        corpus: { in: corpusScope },
      },
    },
  });

  return {
    chunks,
    results,
    suggestedRoutes,
    debug: {
      retrievalMode: 'keyword',
      totalChunksScanned,
      topK,
      corpusScope: corpusScope as string[],
    },
  };
}

/** Custom error class for retrieval errors */
export class RetrievalError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'RetrievalError';
    this.code = code;
  }
}
