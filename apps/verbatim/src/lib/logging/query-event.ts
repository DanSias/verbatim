/**
 * Query Event Logging
 *
 * Persists query/answer events to the database for analytics and debugging.
 * PII-aware: stores question hash and preview by default, full text only when enabled.
 */

import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { getModelPricing, calculateCost } from '@/lib/cost';
import type { LLMProviderName } from '@/lib/llm/types';
import type { AnswerCitation, ConfidenceLevel, AnswerMode } from '@/lib/answer';

/** Event source identifier */
export type QueryEventSource = 'answer' | 'widget';

/** Suggested route for storage */
export interface SuggestedRouteData {
  route: string;
  title: string | null;
}

/** Input data for logging a query event */
export interface QueryEventInput {
  // Context
  workspaceId: string;
  source: QueryEventSource;
  endpoint: string;

  // LLM details
  provider: LLMProviderName;
  model: string;

  // Answer details
  mode: AnswerMode;
  confidence: ConfidenceLevel;

  // Request parameters
  corpusScope: string[];
  topK: number;

  // Question
  question: string;

  // Latency metrics
  latencyMs: number;
  retrievalLatencyMs?: number;
  llmLatencyMs?: number;

  // Retrieval/answer stats
  chunksUsed?: number;
  citations?: AnswerCitation[];
  suggestedRoutes?: SuggestedRouteData[];

  // Token usage
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;

  // Error info (for failed requests)
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Get environment configuration for logging.
 */
function getLoggingConfig() {
  return {
    logQuestionText: process.env.LOG_QUESTION_TEXT === '1',
    questionPreviewChars: parseInt(process.env.LOG_QUESTION_PREVIEW_CHARS || '120', 10),
    maxErrorMessageLength: 500,
  };
}

/**
 * Generate SHA-256 hash of the question text.
 */
function hashQuestion(question: string): string {
  return createHash('sha256').update(question).digest('hex');
}

/**
 * Truncate text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Serialize citations for storage (strip content, keep metadata only).
 */
function serializeCitations(citations: AnswerCitation[] | undefined): object[] | null {
  if (!citations || citations.length === 0) {
    return null;
  }

  return citations.map((c) => ({
    index: c.index,
    corpus: c.corpus,
    ...(c.corpus === 'docs' && { route: c.route, anchor: c.anchor }),
    ...(c.corpus === 'kb' && { sourcePath: c.sourcePath }),
  }));
}

/**
 * Serialize suggested routes for storage.
 */
function serializeSuggestedRoutes(routes: SuggestedRouteData[] | undefined): object[] | null {
  if (!routes || routes.length === 0) {
    return null;
  }

  return routes.map((r) => ({
    route: r.route,
    title: r.title,
  }));
}

/**
 * Log a query event to the database.
 * This is fire-and-forget - errors are logged but don't fail the request.
 */
export async function logQueryEvent(input: QueryEventInput): Promise<void> {
  try {
    const config = getLoggingConfig();

    // Prepare question fields (PII-aware)
    const questionPreview = truncateText(input.question, config.questionPreviewChars);
    const questionHash = hashQuestion(input.question);
    const questionText = config.logQuestionText ? input.question : null;

    // Calculate estimated cost
    const pricing = getModelPricing(input.provider, input.model);
    const estimatedCostUsd = calculateCost(input.inputTokens, input.outputTokens, pricing);

    // Prepare error fields
    const errorMessage = input.errorMessage
      ? truncateText(input.errorMessage, config.maxErrorMessageLength)
      : null;

    await db.queryEvent.create({
      data: {
        workspaceId: input.workspaceId,
        source: input.source,
        endpoint: input.endpoint,
        provider: input.provider,
        model: input.model,
        mode: input.mode,
        confidence: input.confidence,
        corpusScope: input.corpusScope.join(','),
        topK: input.topK,
        questionPreview,
        questionHash,
        questionText,
        questionLength: input.question.length,
        latencyMs: input.latencyMs,
        retrievalLatencyMs: input.retrievalLatencyMs ?? null,
        llmLatencyMs: input.llmLatencyMs ?? null,
        chunksUsed: input.chunksUsed ?? null,
        citationsJson: serializeCitations(input.citations) ?? undefined,
        suggestedRoutesJson: serializeSuggestedRoutes(input.suggestedRoutes) ?? undefined,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        totalTokens: input.totalTokens ?? null,
        estimatedCostUsd,
        errorCode: input.errorCode ?? null,
        errorMessage,
      },
    });
  } catch (error) {
    // Log error but don't throw - this shouldn't break the API response
    console.error('Failed to log query event:', error);
  }
}

/**
 * Log a query event asynchronously without awaiting.
 * Use this to avoid blocking the API response.
 */
export function logQueryEventAsync(input: QueryEventInput): void {
  logQueryEvent(input).catch((error) => {
    console.error('Failed to log query event (async):', error);
  });
}

