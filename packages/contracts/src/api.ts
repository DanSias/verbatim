/**
 * API request and response types for Verbatim endpoints.
 * Based on ARCHITECTURE.md Section 11.
 */

import type {
  Citation,
  Confidence,
  Corpus,
  RelatedRoute,
  SuggestedRoute,
  TicketDraft,
  WidgetContext,
} from './models';

// ============================================================================
// POST /ask
// ============================================================================

export interface AskRequest {
  question: string;
  workspaceId: string;
  conversationId?: string;
  context?: WidgetContext;
  corpusScope?: Corpus[];
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  suggestedRoutes: SuggestedRoute[];
  relatedRoutes: RelatedRoute[];
  confidence: Confidence;
  ticketDraft?: TicketDraft;
  conversationId: string;
}

// ============================================================================
// POST /ingest/batch
// ============================================================================

export interface IngestBatchRequest {
  workspaceId: string;
  corpus: Corpus;
  // Files are sent as multipart/form-data
}

export interface IngestFileResult {
  filename: string;
  status: 'ok' | 'skipped' | 'error';
  canonicalId?: string;
  route?: string;
  error?: string;
}

export interface IngestBatchResponse {
  results: IngestFileResult[];
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
}

// ============================================================================
// POST /ticket-draft
// ============================================================================

export interface TicketDraftRequest {
  workspaceId: string;
  conversationId: string;
  additionalContext?: string;
}

export interface TicketDraftResponse {
  draft: TicketDraft;
}

// ============================================================================
// POST /tickets (feature-flagged, v1 disabled)
// ============================================================================

export interface CreateTicketRequest {
  workspaceId: string;
  conversationId: string;
  draft: TicketDraft;
}

export interface CreateTicketResponse {
  ticketId: string;
  ticketUrl: string;
}

// ============================================================================
// Error responses
// ============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
