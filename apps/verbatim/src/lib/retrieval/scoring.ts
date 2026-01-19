/**
 * Pure Scoring Utilities
 *
 * Deterministic keyword-based scoring functions.
 * No database dependencies - can be unit tested in isolation.
 *
 * Scoring algorithm:
 * - Tokenize question into terms (with phrase preservation, synonyms, plurals)
 * - Score chunks by term frequency / overlap with weighted factors
 * - Apply proximity bonus for closely grouped terms
 * - Normalize by content length
 */

// ============================================================================
// Scoring Weights (tunable constants)
// ============================================================================

/** Weight for a single term match in content */
export const WEIGHT_CONTENT_TERM = 1.0;

/** Weight for a term match in heading path */
export const WEIGHT_HEADING_TERM = 2.5;

/** Weight for an exact phrase match in content */
export const WEIGHT_PHRASE_CONTENT = 3.0;

/** Weight for an exact phrase match in heading */
export const WEIGHT_PHRASE_HEADING = 4.0;

/** Bonus multiplier for terms appearing close together */
export const WEIGHT_PROXIMITY_BONUS = 0.5;

/** Maximum character distance for proximity bonus */
export const PROXIMITY_WINDOW = 30;

/** Minimum content length for full normalization (avoids over-boosting tiny chunks) */
export const MIN_LENGTH_FOR_NORMALIZATION = 100;

// ============================================================================
// Synonym Map
// ============================================================================

/**
 * Bidirectional synonym map for query expansion.
 * Each key maps to its synonyms; lookups work both directions.
 */
const SYNONYM_PAIRS: Array<[string, string]> = [
  // ---------------------------------------------------------------------------
  // Accounts & Onboarding
  // ---------------------------------------------------------------------------
  ['merchant', 'account'],
  ['merchant', 'mid'],
  ['onboarding', 'setup'],
  ['setup', 'configure'],
  ['configuration', 'setup'],
  ['config', 'setup'],
  ['install', 'setup'],
  ['activation', 'enable'],
  ['enable', 'activate'],
  ['verification', 'verify'],
  ['kyc', 'verification'],
  ['compliance', 'regulatory'],

  // ---------------------------------------------------------------------------
  // Authentication & Authorization
  // ---------------------------------------------------------------------------
  ['authenticate', 'auth'],
  ['authentication', 'auth'],
  ['authorize', 'auth'],
  ['authorization', 'auth'],
  ['token', 'credential'],
  ['key', 'credential'],
  ['secret', 'credential'],

  // ---------------------------------------------------------------------------
  // APIs & SDKs
  // ---------------------------------------------------------------------------
  ['api', 'endpoint'],
  ['sdk', 'library'],
  ['client', 'sdk'],
  ['request', 'call'],
  ['response', 'reply'],
  ['schema', 'model'],
  ['object', 'resource'],

  // ---------------------------------------------------------------------------
  // Payments & Transactions
  // ---------------------------------------------------------------------------
  ['payment', 'transaction'],
  ['chargeback', 'dispute'],
  ['refund', 'reversal'],
  ['void', 'cancel'],
  ['settlement', 'payout'],
  ['capture', 'settlement'],
  ['decline', 'failure'],
  ['failed', 'failure'],
  ['success', 'approved'],
  ['payout', 'disbursement'],

  // ---------------------------------------------------------------------------
  // Webhooks & Events
  // ---------------------------------------------------------------------------
  ['webhook', 'callback'],
  ['event', 'notification'],
  ['retry', 'replay'],
  ['delivery', 'dispatch'],
  ['signature', 'hmac'],
  ['payload', 'body'],

  // ---------------------------------------------------------------------------
  // Errors & Diagnostics
  // ---------------------------------------------------------------------------
  ['error', 'exception'],
  ['timeout', 'latency'],
  ['limit', 'quota'],
];

/** Build lookup map from synonym pairs */
function buildSynonymMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const [a, b] of SYNONYM_PAIRS) {
    // a -> b
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);

    // b -> a
    if (!map.has(b)) map.set(b, new Set());
    map.get(b)!.add(a);
  }

  return map;
}

const SYNONYM_MAP = buildSynonymMap();

/**
 * Get synonyms for a term.
 *
 * @param term - The term to look up
 * @returns Set of synonyms (empty if none)
 */
export function getSynonyms(term: string): Set<string> {
  return SYNONYM_MAP.get(term) ?? new Set();
}

// ============================================================================
// Plural Normalization
// ============================================================================

/**
 * Simple plural normalization (English only).
 * Converts common plural forms to singular.
 *
 * Rules applied:
 * - words ending in 'ies' -> 'y' (e.g., queries -> query)
 * - words ending in 'es' where base ends in s/x/z/ch/sh -> remove 'es'
 * - words ending in 's' -> remove 's'
 *
 * @param word - The word to normalize
 * @returns Normalized singular form
 */
export function normalizePlural(word: string): string {
  if (word.length < 3) return word;

  // Handle 'ies' -> 'y' (e.g., queries -> query, bodies -> body)
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }

  // Handle 'es' for sibilant endings (e.g., boxes -> box, watches -> watch)
  if (word.endsWith('es') && word.length > 3) {
    const base = word.slice(0, -2);
    if (
      base.endsWith('s') ||
      base.endsWith('x') ||
      base.endsWith('z') ||
      base.endsWith('ch') ||
      base.endsWith('sh')
    ) {
      return base;
    }
  }

  // Handle regular 's' plurals (e.g., webhooks -> webhook)
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
}

// ============================================================================
// Stop Words
// ============================================================================

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'do',
  'does',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'can',
  'could',
  'would',
  'should',
]);

// ============================================================================
// Tokenization
// ============================================================================

/**
 * Result from tokenization containing both individual terms and phrases.
 */
export interface TokenizeResult {
  /** Individual terms (normalized, with synonyms expanded) */
  terms: string[];
  /** Quoted phrases preserved as-is (lowercased) */
  phrases: string[];
}

/**
 * Tokenize text into terms and phrases.
 *
 * Features:
 * - Preserves quoted phrases (e.g., "merchant account")
 * - Normalizes plurals (accounts -> account)
 * - Expands synonyms (webhook -> [webhook, callback])
 * - Removes stop words
 *
 * @param text - The text to tokenize
 * @returns Object containing terms and phrases
 */
export function tokenize(text: string): string[] {
  const result = tokenizeWithPhrases(text);
  return result.terms;
}

/**
 * Extended tokenization that also returns preserved phrases.
 *
 * @param text - The text to tokenize
 * @returns Object containing terms and phrases
 */
export function tokenizeWithPhrases(text: string): TokenizeResult {
  const phrases: string[] = [];
  let remaining = text;

  // Extract quoted phrases first
  const quoteRegex = /"([^"]+)"/g;
  let match;
  while ((match = quoteRegex.exec(text)) !== null) {
    const phrase = match[1].trim().toLowerCase();
    if (phrase.length > 0) {
      phrases.push(phrase);
    }
  }

  // Remove quoted sections from text for term extraction
  remaining = remaining.replace(quoteRegex, ' ');

  // Split on non-word characters and filter
  const words = remaining.toLowerCase().split(/\W+/).filter(Boolean);

  // Process words: normalize plurals, expand synonyms, filter stop words
  const termSet = new Set<string>();

  for (const word of words) {
    if (word.length <= 1 || STOP_WORDS.has(word)) {
      continue;
    }

    // Normalize plural
    const normalized = normalizePlural(word);
    termSet.add(normalized);

    // Also add original if different (helps with edge cases)
    if (normalized !== word) {
      termSet.add(word);
    }

    // Expand synonyms
    const synonyms = getSynonyms(normalized);
    for (const syn of synonyms) {
      termSet.add(syn);
    }
  }

  return {
    terms: Array.from(termSet),
    phrases,
  };
}

// ============================================================================
// Occurrence Counting
// ============================================================================

/**
 * Count occurrences of a term in text.
 *
 * @param text - The text to search in
 * @param term - The term to count
 * @returns Number of occurrences
 */
export function countOccurrences(text: string, term: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) {
    count++;
    pos += term.length;
  }
  return count;
}

// ============================================================================
// Scoring Helpers
// ============================================================================

/**
 * Score content based on individual term matches.
 *
 * @param contentLower - Lowercased content text
 * @param terms - Query terms to match
 * @returns Weighted score for content term matches
 */
export function scoreContentTerms(contentLower: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    const matches = countOccurrences(contentLower, term);
    score += matches * WEIGHT_CONTENT_TERM;
  }
  return score;
}

/**
 * Score heading path based on term matches.
 *
 * @param headingTextLower - Lowercased heading path text
 * @param terms - Query terms to match
 * @returns Weighted score for heading matches
 */
export function scoreHeadingTerms(headingTextLower: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    if (headingTextLower.includes(term)) {
      score += WEIGHT_HEADING_TERM;
    }
  }
  return score;
}

/**
 * Score exact phrase matches in content and headings.
 *
 * @param contentLower - Lowercased content text
 * @param headingTextLower - Lowercased heading path text
 * @param phrases - Exact phrases to match
 * @returns Weighted score for phrase matches
 */
export function scorePhraseMatches(
  contentLower: string,
  headingTextLower: string,
  phrases: string[],
): number {
  let score = 0;
  for (const phrase of phrases) {
    // Phrase in heading (highest value)
    if (headingTextLower.includes(phrase)) {
      score += WEIGHT_PHRASE_HEADING;
    }
    // Phrase in content
    const contentMatches = countOccurrences(contentLower, phrase);
    score += contentMatches * WEIGHT_PHRASE_CONTENT;
  }
  return score;
}

/**
 * Calculate proximity bonus when multiple terms appear close together.
 *
 * Finds positions of all term occurrences and rewards when different
 * terms appear within PROXIMITY_WINDOW characters of each other.
 *
 * @param contentLower - Lowercased content text
 * @param terms - Query terms to check proximity
 * @returns Proximity bonus score
 */
export function scoreProximityBonus(contentLower: string, terms: string[]): number {
  if (terms.length < 2) return 0;

  // Find all positions of each term
  const termPositions: Map<string, number[]> = new Map();

  for (const term of terms) {
    const positions: number[] = [];
    let pos = 0;
    while ((pos = contentLower.indexOf(term, pos)) !== -1) {
      positions.push(pos);
      pos += term.length;
    }
    if (positions.length > 0) {
      termPositions.set(term, positions);
    }
  }

  // Need at least 2 different terms with matches
  const matchedTerms = Array.from(termPositions.keys());
  if (matchedTerms.length < 2) return 0;

  // Count proximity pairs (each unique pair of different terms within window)
  let proximityCount = 0;
  const counted = new Set<string>(); // Avoid counting same pair multiple times

  for (let i = 0; i < matchedTerms.length; i++) {
    const term1 = matchedTerms[i];
    const positions1 = termPositions.get(term1)!;

    for (let j = i + 1; j < matchedTerms.length; j++) {
      const term2 = matchedTerms[j];
      const positions2 = termPositions.get(term2)!;

      // Check if any occurrence of term1 is within window of any occurrence of term2
      for (const pos1 of positions1) {
        for (const pos2 of positions2) {
          const distance = Math.abs(pos1 - pos2);
          if (distance <= PROXIMITY_WINDOW) {
            const pairKey = `${Math.min(pos1, pos2)}-${Math.max(pos1, pos2)}`;
            if (!counted.has(pairKey)) {
              counted.add(pairKey);
              proximityCount++;
            }
          }
        }
      }
    }
  }

  return proximityCount * WEIGHT_PROXIMITY_BONUS;
}

/**
 * Normalize score by content length.
 *
 * Uses sqrt normalization to reduce bias toward long chunks while
 * still giving some credit to comprehensive content.
 *
 * Includes a floor to prevent over-boosting very short chunks.
 *
 * @param score - Raw score to normalize
 * @param contentLength - Length of the content
 * @returns Normalized score
 */
export function normalizeScore(score: number, contentLength: number): number {
  if (score === 0) return 0;

  // Use effective length with a floor to avoid over-boosting tiny chunks
  const effectiveLength = Math.max(contentLength, MIN_LENGTH_FOR_NORMALIZATION);
  const lengthFactor = Math.sqrt(effectiveLength / 1000);

  if (lengthFactor > 0) {
    return score / lengthFactor;
  }

  return score;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score a chunk based on term overlap with query terms.
 *
 * Scoring factors:
 * - Term frequency in content (weight: 1.0)
 * - Bonus for matches in headingPath (weight: 2.5)
 * - Exact phrase matches in content (weight: 3.0)
 * - Exact phrase matches in heading (weight: 4.0)
 * - Proximity bonus for closely grouped terms (weight: 0.5 per pair)
 * - Normalize by content length to avoid bias toward longer chunks
 *
 * @param content - The chunk content
 * @param headingPath - The heading breadcrumb
 * @param queryTerms - The tokenized query terms
 * @returns The computed score
 */
export function scoreChunk(content: string, headingPath: string[], queryTerms: string[]): number {
  const contentLower = content.toLowerCase();
  const headingText = headingPath.join(' ').toLowerCase();

  // Score individual term matches
  const contentScore = scoreContentTerms(contentLower, queryTerms);
  const headingScore = scoreHeadingTerms(headingText, queryTerms);

  // Calculate proximity bonus
  const proximityScore = scoreProximityBonus(contentLower, queryTerms);

  // Combine scores
  let totalScore = contentScore + headingScore + proximityScore;

  // Normalize by content length
  totalScore = normalizeScore(totalScore, content.length);

  return totalScore;
}

/**
 * Extended scoring that also considers phrases.
 *
 * Use this when you have extracted phrases from the query via tokenizeWithPhrases().
 *
 * @param content - The chunk content
 * @param headingPath - The heading breadcrumb
 * @param queryTerms - The tokenized query terms
 * @param queryPhrases - Exact phrases from quoted sections
 * @returns The computed score
 */
export function scoreChunkWithPhrases(
  content: string,
  headingPath: string[],
  queryTerms: string[],
  queryPhrases: string[],
): number {
  const contentLower = content.toLowerCase();
  const headingText = headingPath.join(' ').toLowerCase();

  // Score individual term matches
  const contentScore = scoreContentTerms(contentLower, queryTerms);
  const headingScore = scoreHeadingTerms(headingText, queryTerms);

  // Score phrase matches
  const phraseScore = scorePhraseMatches(contentLower, headingText, queryPhrases);

  // Calculate proximity bonus
  const proximityScore = scoreProximityBonus(contentLower, queryTerms);

  // Combine scores
  let totalScore = contentScore + headingScore + phraseScore + proximityScore;

  // Normalize by content length
  totalScore = normalizeScore(totalScore, content.length);

  return totalScore;
}
