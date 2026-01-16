/**
 * Keyword-based Retrieval
 *
 * Deterministic fallback retrieval using term overlap scoring.
 * This can be replaced with vector search when embeddings are implemented.
 *
 * Scoring algorithm:
 * - Tokenize question into terms
 * - Score chunks by term frequency / overlap
 * - Return top K chunks sorted by score
 */

import { db } from '@/lib/db';
import type { Corpus } from '@prisma/client';

/** A retrieved chunk with its score and metadata */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  canonicalId: string;
  corpus: Corpus;
  route: string | null;
  sourcePath: string;
  title: string | null;
  headingPath: string[];
  anchor: string | null;
  content: string;
  score: number;
}

/** Options for keyword retrieval */
export interface KeywordRetrievalOptions {
  workspaceId: string;
  question: string;
  topK: number;
  corpusScope: Corpus[];
}

/**
 * Perform keyword-based retrieval across chunks.
 *
 * @param options - Retrieval options
 * @returns Array of retrieved chunks sorted by score (descending)
 */
export async function keywordSearch(
  options: KeywordRetrievalOptions
): Promise<RetrievedChunk[]> {
  const { workspaceId, question, topK, corpusScope } = options;

  // Tokenize question
  const queryTerms = tokenize(question);

  if (queryTerms.length === 0) {
    return [];
  }

  // Fetch all chunks from the workspace with matching corpus
  // In production, this would use full-text search or vector similarity
  const chunks = await db.chunk.findMany({
    where: {
      document: {
        workspaceId,
        corpus: { in: corpusScope },
      },
    },
    include: {
      document: {
        select: {
          id: true,
          canonicalId: true,
          corpus: true,
          route: true,
          sourcePath: true,
          title: true,
        },
      },
    },
  });

  // Score each chunk
  const scoredChunks: RetrievedChunk[] = chunks.map((chunk) => {
    const score = scoreChunk(chunk.content, chunk.headingPath, queryTerms);
    return {
      chunkId: chunk.id,
      documentId: chunk.document.id,
      canonicalId: chunk.document.canonicalId,
      corpus: chunk.document.corpus,
      route: chunk.document.route,
      sourcePath: chunk.document.sourcePath,
      title: chunk.document.title,
      headingPath: chunk.headingPath,
      anchor: chunk.anchor,
      content: chunk.content,
      score,
    };
  });

  // Sort by score (descending) and take top K
  return scoredChunks
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Tokenize text into lowercase terms.
 * Removes punctuation and common stop words.
 */
function tokenize(text: string): string[] {
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
 * Score a chunk based on term overlap with query terms.
 *
 * Scoring factors:
 * - Term frequency in content
 * - Bonus for matches in headingPath
 * - Normalize by content length to avoid bias toward longer chunks
 */
function scoreChunk(
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

/**
 * Count occurrences of a term in text.
 */
function countOccurrences(text: string, term: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) {
    count++;
    pos += term.length;
  }
  return count;
}
