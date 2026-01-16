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
import { tokenize, scoreChunk } from './scoring';

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

// Pure scoring functions are imported from ./scoring.ts
