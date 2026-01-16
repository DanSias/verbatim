/**
 * Core domain models for Verbatim.
 * Based on ARCHITECTURE.md Section 4.
 */

/** Corpus types supported in v1 */
export type Corpus = 'docs' | 'kb';

/** Confidence levels for answer responses */
export type ConfidenceLabel = 'high' | 'medium' | 'low';

/** A citation reference to a source used in an answer */
export interface Citation {
  corpus: Corpus;
  canonicalId: string;
  route?: string;
  sourcePath: string;
  headingPath?: string[];
  excerpt?: string;
}

/** A suggested route for navigation */
export interface SuggestedRoute {
  route: string;
  title?: string;
  reason?: string;
}

/** A related route for additional navigation */
export interface RelatedRoute {
  route: string;
  title?: string;
}

/** Confidence metadata for an answer */
export interface Confidence {
  score: number;
  label: ConfidenceLabel;
}

/** Ticket draft generated from conversation */
export interface TicketDraft {
  subject: string;
  description: string;
  includedCitations: string[];
}

/** Context provided by the widget/client */
export interface WidgetContext {
  route?: string;
  pageTitle?: string;
  navSection?: string;
}
