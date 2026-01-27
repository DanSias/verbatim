/**
 * POST /api/ask
 *
 * Retrieval-only Q&A endpoint for Verbatim.
 * Returns best matching chunks and citations without LLM generation.
 *
 * See ARCHITECTURE.md Section 11.3.
 *
 * Request:
 *   - workspaceId: string (required)
 *   - question: string (required)
 *   - conversationId?: string (echoed back; memory not implemented yet)
 *   - topK?: number (default 8)
 *   - corpusScope?: Array<'docs'|'kb'> (default both)
 *
 * Response:
 *   - question, workspaceId, conversationId
 *   - results: ranked chunks with citations
 *   - suggestedRoutes: docs-only route suggestions
 *   - debug: retrieval mode info
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Corpus } from '@prisma/client';
import {
  retrieve,
  RetrievalError,
  type SearchResult,
  type SuggestedRoute,
} from '@/lib/retrieval';
import { logQueryRun } from '@/lib/query-run';

// Force Node.js runtime
export const runtime = 'nodejs';

/** Request body shape */
interface AskRequest {
  workspaceId: string;
  question: string;
  conversationId?: string;
  topK?: number;
  corpusScope?: Array<'docs' | 'kb'>;
}

/** Response shape for retrieval-only mode */
interface AskResponse {
  question: string;
  workspaceId: string;
  conversationId: string;
  results: SearchResult[];
  suggestedRoutes: SuggestedRoute[];
  debug: {
    retrievalMode: 'vector' | 'keyword';
    totalChunksScanned: number;
    topK: number;
    corpusScope: string[];
  };
}

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/** Default corpus scope */
const DEFAULT_CORPUS_SCOPE: Corpus[] = ['docs', 'kb'];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskRequest;

    // Validate required fields
    if (!body.workspaceId) {
      return errorResponse('Missing required field: workspaceId', 'VALIDATION_ERROR', 400);
    }
    if (!body.question) {
      return errorResponse('Missing required field: question', 'VALIDATION_ERROR', 400);
    }

    const workspaceId = body.workspaceId;
    const question = body.question.trim();
    const conversationId = body.conversationId ?? crypto.randomUUID();
    const topK = body.topK;
    const corpusScope = validateCorpusScope(body.corpusScope) ?? DEFAULT_CORPUS_SCOPE;

    // Use shared retrieval function
    const retrieval = await retrieve({
      workspaceId,
      question,
      topK,
      corpusScope,
    });

    // Log query run (non-blocking, fire-and-forget)
    void logQueryRun({
      workspaceId,
      question,
      scope: corpusScope,
      topK: retrieval.debug.topK,
      retrievalMode: retrieval.debug.retrievalMode,
      results: retrieval.results,
    }).catch((err) => {
      // Already logged in logQueryRun, but catch to ensure promise doesn't reject
      console.warn('[Ask] Query run logging failed:', err);
    });

    const response: AskResponse = {
      question,
      workspaceId,
      conversationId,
      results: retrieval.results,
      suggestedRoutes: retrieval.suggestedRoutes,
      debug: retrieval.debug,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Ask endpoint error:', error);

    if (error instanceof RetrievalError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 500;
      return errorResponse(error.message, error.code, status);
    }

    return errorResponse(
      'Internal server error',
      'INTERNAL_ERROR',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Validate and normalize corpus scope.
 */
function validateCorpusScope(scope?: Array<'docs' | 'kb'>): Corpus[] | null {
  if (!scope || !Array.isArray(scope)) {
    return null;
  }

  const valid: Corpus[] = [];
  for (const s of scope) {
    if (s === 'docs' || s === 'kb') {
      valid.push(s);
    }
  }

  return valid.length > 0 ? valid : null;
}

/**
 * Build an error response.
 */
function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  const error: ApiError = { error: message, code };
  if (details) {
    error.details = details;
  }
  return NextResponse.json(error, { status });
}
