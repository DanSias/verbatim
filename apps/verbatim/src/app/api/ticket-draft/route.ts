/**
 * POST /api/ticket-draft
 *
 * Generate a ticket draft from conversation context.
 * See ARCHITECTURE.md Section 11.3 and Section 12.
 *
 * Request: TicketDraftRequest
 * Response: TicketDraftResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import type { TicketDraftRequest, TicketDraftResponse, ApiError } from '@verbatim/contracts';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TicketDraftRequest;

    // Validate required fields
    if (!body.workspaceId || !body.conversationId) {
      const error: ApiError = {
        error: 'Missing required fields: workspaceId, conversationId',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // TODO: Implement ticket draft generation
    // 1. Load conversation history
    // 2. Summarize user issue
    // 3. Extract steps tried
    // 4. Gather relevant citations
    // 5. Format ticket draft

    const response: TicketDraftResponse = {
      draft: {
        subject: 'Not implemented',
        description: 'Ticket draft generation not yet implemented.',
        includedCitations: [],
      },
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
