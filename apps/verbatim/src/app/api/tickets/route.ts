/**
 * POST /api/tickets
 *
 * Create a Freshdesk ticket (feature-flagged).
 * See ARCHITECTURE.md Section 11.3 and Section 12.
 *
 * Request: CreateTicketRequest
 * Response: CreateTicketResponse
 *
 * NOTE: This endpoint is disabled in v1 (ENABLE_FRESHDESK_TICKETS=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiError } from '@verbatim/contracts';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Check feature flag
  const isEnabled = process.env.ENABLE_FRESHDESK_TICKETS === 'true';

  if (!isEnabled) {
    const error: ApiError = {
      error: 'Ticket creation is disabled',
      code: 'FEATURE_DISABLED',
      details: {
        featureFlag: 'ENABLE_FRESHDESK_TICKETS',
        message: 'Ticket creation is disabled in v1. Use /api/ticket-draft instead.',
      },
    };
    return NextResponse.json(error, { status: 403 });
  }

  // TODO: Implement Freshdesk ticket creation when enabled
  // 1. Validate request body
  // 2. Authenticate with Freshdesk API
  // 3. Create ticket
  // 4. Return ticket ID and URL

  const error: ApiError = {
    error: 'Not implemented',
    code: 'NOT_IMPLEMENTED',
  };
  return NextResponse.json(error, { status: 501 });
}
