/**
 * Confidence Scoring
 *
 * Deterministic confidence scoring based on retrieval signals.
 * See ARCHITECTURE.md Section 9.3 for low confidence triggers.
 *
 * Confidence is computed from:
 * - Number and quality of retrieved chunks
 * - Score distribution (gap between top scores)
 * - Corpus distribution (docs vs KB)
 * - Whether docs appear in top results
 */

import type { SearchResult, SuggestedRoute } from '@/lib/retrieval';

/** Confidence levels */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Signals used to compute confidence (for debugging) */
export interface ConfidenceSignals {
  /** Score of top result (0 if no results) */
  topScore: number;
  /** Score of second result (0 if < 2 results) */
  secondScore: number;
  /** Gap between top and second scores */
  scoreGap: number;
  /** Number of docs corpus results */
  docsCount: number;
  /** Number of KB corpus results */
  kbCount: number;
  /** Whether top result is from docs */
  hasDocsTop1: boolean;
  /** Total number of results */
  resultCount: number;
  /** Number of suggested routes */
  suggestedRoutesCount: number;
  /** Average score of top 3 results */
  avgTop3Score: number;
}

/** Result of confidence computation */
export interface ConfidenceResult {
  /** Computed confidence level */
  confidence: ConfidenceLevel;
  /** Signals used in computation */
  signals: ConfidenceSignals;
}

/** Thresholds for confidence scoring */
const THRESHOLDS = {
  /** Minimum score to consider a result relevant */
  minRelevantScore: 0.5,
  /** Score gap required for high confidence */
  highConfidenceGap: 1.0,
  /** Minimum top score for high confidence */
  highConfidenceMinScore: 2.0,
  /** Minimum docs count for high confidence */
  highConfidenceMinDocs: 2,
  /** Score below which confidence is low */
  lowScoreThreshold: 0.3,
  /** Minimum results for medium confidence */
  minResultsForMedium: 1,
};

/**
 * Compute confidence from retrieval results.
 *
 * Rules:
 * - No results => low
 * - Very low top score => low
 * - Docs in top 1 + multiple docs + good score gap => high
 * - Docs in top 1 + at least one docs result => medium
 * - KB only with decent score => medium
 * - Otherwise => low
 *
 * @param results - Search results from retrieval
 * @param suggestedRoutes - Suggested routes from retrieval
 * @returns Confidence level and signals
 */
export function computeConfidence(
  results: SearchResult[],
  suggestedRoutes: SuggestedRoute[]
): ConfidenceResult {
  // Compute signals
  const signals = computeSignals(results, suggestedRoutes);

  // Determine confidence level
  const confidence = determineConfidence(signals);

  return { confidence, signals };
}

/**
 * Compute signals from results.
 */
function computeSignals(
  results: SearchResult[],
  suggestedRoutes: SuggestedRoute[]
): ConfidenceSignals {
  const topScore = results[0]?.score ?? 0;
  const secondScore = results[1]?.score ?? 0;
  const scoreGap = topScore - secondScore;

  const docsCount = results.filter((r) => r.corpus === 'docs').length;
  const kbCount = results.filter((r) => r.corpus === 'kb').length;
  const hasDocsTop1 = results[0]?.corpus === 'docs';

  // Compute average of top 3 scores
  const top3 = results.slice(0, 3);
  const avgTop3Score =
    top3.length > 0
      ? top3.reduce((sum, r) => sum + r.score, 0) / top3.length
      : 0;

  return {
    topScore,
    secondScore,
    scoreGap,
    docsCount,
    kbCount,
    hasDocsTop1,
    resultCount: results.length,
    suggestedRoutesCount: suggestedRoutes.length,
    avgTop3Score,
  };
}

/**
 * Determine confidence level from signals.
 */
function determineConfidence(signals: ConfidenceSignals): ConfidenceLevel {
  const {
    topScore,
    scoreGap,
    docsCount,
    hasDocsTop1,
    resultCount,
    avgTop3Score,
  } = signals;

  // No results => low
  if (resultCount === 0) {
    return 'low';
  }

  // Very low top score => low
  if (topScore < THRESHOLDS.lowScoreThreshold) {
    return 'low';
  }

  // High confidence criteria:
  // - Top result is from docs
  // - At least 2 docs results
  // - Good score gap OR high average score
  // - Top score is above threshold
  if (
    hasDocsTop1 &&
    docsCount >= THRESHOLDS.highConfidenceMinDocs &&
    topScore >= THRESHOLDS.highConfidenceMinScore &&
    (scoreGap >= THRESHOLDS.highConfidenceGap || avgTop3Score >= THRESHOLDS.highConfidenceMinScore)
  ) {
    return 'high';
  }

  // Medium confidence criteria:
  // - Has docs in top result with at least 1 docs result, OR
  // - Has decent average score
  if (
    (hasDocsTop1 && docsCount >= 1) ||
    avgTop3Score >= THRESHOLDS.minRelevantScore
  ) {
    return 'medium';
  }

  // KB-only with decent score => medium
  if (docsCount === 0 && topScore >= THRESHOLDS.minRelevantScore) {
    return 'medium';
  }

  // Otherwise => low
  return 'low';
}

/**
 * Check if confidence meets a minimum threshold.
 *
 * @param actual - Actual confidence level
 * @param minimum - Minimum required confidence
 * @returns True if actual meets or exceeds minimum
 */
export function meetsConfidenceThreshold(
  actual: ConfidenceLevel,
  minimum: ConfidenceLevel
): boolean {
  const levels: Record<ConfidenceLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return levels[actual] >= levels[minimum];
}
