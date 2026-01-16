/**
 * Pure Scoring Utilities
 *
 * Deterministic keyword-based scoring functions.
 * No database dependencies - can be unit tested in isolation.
 *
 * Scoring algorithm:
 * - Tokenize question into terms
 * - Score chunks by term frequency / overlap
 * - Normalize by content length
 */

/**
 * Tokenize text into lowercase terms.
 * Removes punctuation and common stop words.
 *
 * @param text - The text to tokenize
 * @returns Array of filtered terms
 */
export function tokenize(text: string): string[] {
  // Convert to lowercase and split on non-word characters
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);

  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
    'the', 'to', 'was', 'were', 'will', 'with', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'do', 'does', 'how', 'what', 'when',
    'where', 'which', 'who', 'why', 'can', 'could', 'would', 'should',
  ]);

  return words.filter((w) => w.length > 1 && !stopWords.has(w));
}

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

/**
 * Score a chunk based on term overlap with query terms.
 *
 * Scoring factors:
 * - Term frequency in content
 * - Bonus for matches in headingPath
 * - Normalize by content length to avoid bias toward longer chunks
 *
 * @param content - The chunk content
 * @param headingPath - The heading breadcrumb
 * @param queryTerms - The tokenized query terms
 * @returns The computed score
 */
export function scoreChunk(
  content: string,
  headingPath: string[],
  queryTerms: string[]
): number {
  const contentLower = content.toLowerCase();
  const headingText = headingPath.join(' ').toLowerCase();

  let score = 0;

  for (const term of queryTerms) {
    // Count occurrences in content
    const contentMatches = countOccurrences(contentLower, term);
    score += contentMatches;

    // Bonus for heading matches (headings are important context)
    if (headingText.includes(term)) {
      score += 2;
    }
  }

  // Normalize by sqrt of content length to reduce bias toward long chunks
  // but still give some credit to comprehensive content
  const lengthFactor = Math.sqrt(content.length / 1000);
  if (lengthFactor > 0) {
    score = score / lengthFactor;
  }

  return score;
}
