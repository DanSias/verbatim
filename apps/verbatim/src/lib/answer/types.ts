/**
 * Answer Module Types
 *
 * Shared types for the answer synthesis layer.
 */

import type { ConfidenceLevel, ConfidenceSignals } from './confidence';

/** Citation reference in an answer */
export interface AnswerCitation {
  /** 1-based index matching source number */
  index: number;
  /** Corpus source */
  corpus: 'docs' | 'kb';
  /** Route (docs only) */
  route?: string;
  /** Anchor (docs only) */
  anchor?: string | null;
  /** Full URL (docs only) */
  url?: string;
  /** Source path (KB only) */
  sourcePath?: string;
}

/**
 * Ticket draft for support escalation.
 *
 * Generated when confidence is low or explicitly requested.
 * See ARCHITECTURE.md Section 12.
 */
export interface TicketDraft {
  /** Short title (max 80 chars) derived from question */
  title: string;
  /** Summary bullets (3-6 points) */
  summary: string[];
  /** Original user question */
  userQuestion: string;
  /** Attempted answer if available */
  attemptedAnswer?: string;
  /** Suggested next steps or info to gather */
  suggestedNextInfo: string[];
  /** Citations from the answer/retrieval */
  citations: AnswerCitation[];
}

/** Response mode */
export type AnswerMode = 'answer' | 'ticket_draft';

/** Extended debug info including confidence */
export interface AnswerDebug {
  /** LLM provider used */
  provider: string;
  /** Model name */
  model: string;
  /** Retrieval mode */
  retrievalMode: 'vector' | 'keyword';
  /** Top K parameter */
  topK: number;
  /** Corpus scope */
  corpusScope: string[];
  /** Number of chunks used */
  chunksUsed: number;
  /** Confidence signals */
  confidenceSignals: ConfidenceSignals;
}

/** Full response from /api/answer */
export interface AnswerResponse {
  /** Original question */
  question: string;
  /** Workspace ID */
  workspaceId: string;
  /** Generated answer */
  answer: string;
  /** Citations extracted from answer */
  citations: AnswerCitation[];
  /** Suggested docs routes */
  suggestedRoutes: Array<{ route: string; title: string | null }>;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Response mode */
  mode: AnswerMode;
  /** Ticket draft (when mode is ticket_draft or confidence is low) */
  ticketDraft?: TicketDraft;
  /** Debug information */
  debug: AnswerDebug;
}
