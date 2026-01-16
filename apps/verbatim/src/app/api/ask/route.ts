/**
 * POST /api/ask
 *
 * Main Q&A endpoint for Verbatim.
 * See ARCHITECTURE.md Section 11.3.
 *
 * Request: AskRequest
 * Response: AskResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AskRequest, AskResponse, ApiError } from '@verbatim/contracts';

// Force Node.js runtime (not Edge) for embedding operations
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskRequest;

    // Validate required fields
    if (!body.question || !body.workspaceId) {
      const error: ApiError = {
        error: 'Missing required fields: question, workspaceId',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // TODO: Implement retrieval and answer generation
    // 1. Retrieve relevant chunks from vector store
    // 2. Generate answer with citations
    // 3. Determine suggested routes
    // 4. Assess confidence
    // 5. Generate ticket draft if low confidence

    const response: AskResponse = {
      answer: 'Not implemented',
      citations: [],
      suggestedRoutes: [],
      relatedRoutes: [],
      confidence: { score: 0, label: 'low' },
      conversationId: body.conversationId ?? crypto.randomUUID(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const apiError: ApiError = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}
