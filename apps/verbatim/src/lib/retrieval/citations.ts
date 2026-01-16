/**
 * Citation Building Utilities
 *
 * Builds citation objects for retrieved chunks.
 * See ARCHITECTURE.md Section 4.5 and Section 8.3.
 *
 * Key constraints:
 * - Docs citations include route, anchor, and linkable URL
 * - KB citations include only sourcePath (no route, no URL)
 */

import type { RetrievedChunk } from './keyword-search';

/** Citation for a docs chunk (linkable) */
export interface DocsCitation {
  route: string;
  anchor: string | null;
  url: string;
}

/** Citation for a KB chunk (not linkable) */
export interface KbCitation {
  sourcePath: string;
}

/** Union type for citations */
export type Citation = DocsCitation | KbCitation;

/** A search result with citation */
export interface SearchResult {
  corpus: 'docs' | 'kb';
  documentId: string;
  canonicalId: string;
  chunkId: string;
  headingPath: string[];
  score: number;
  citation: Citation;
  excerpt: string;
}

/**
 * Build a citation object for a retrieved chunk.
 *
 * @param chunk - The retrieved chunk
 * @returns Citation object (DocsCitation or KbCitation)
 */
export function buildCitation(chunk: RetrievedChunk): Citation {
  if (chunk.corpus === 'docs') {
    // Docs: include route, anchor, and linkable URL
    const route = chunk.route || '/';
    const anchor = chunk.anchor;
    const url = anchor ? `${route}#${anchor}` : route;

    return {
      route,
      anchor,
      url,
    } as DocsCitation;
  } else {
    // KB: only sourcePath, no route or URL
    return {
      sourcePath: chunk.sourcePath,
    } as KbCitation;
  }
}

/**
 * Build an excerpt from chunk content.
 * Returns first ~300-500 characters, breaking at word boundary.
 *
 * @param content - Full chunk content
 * @param maxLength - Maximum excerpt length (default 400)
 * @returns Truncated excerpt
 */
export function buildExcerpt(content: string, maxLength: number = 400): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Find a good break point (end of sentence or word)
  let breakPoint = content.lastIndexOf('. ', maxLength);
  if (breakPoint < maxLength / 2) {
    breakPoint = content.lastIndexOf(' ', maxLength);
  }
  if (breakPoint < maxLength / 2) {
    breakPoint = maxLength;
  }

  return content.slice(0, breakPoint).trim() + '...';
}

/**
 * Convert a retrieved chunk to a search result.
 *
 * @param chunk - The retrieved chunk
 * @returns SearchResult with citation and excerpt
 */
export function toSearchResult(chunk: RetrievedChunk): SearchResult {
  return {
    corpus: chunk.corpus,
    documentId: chunk.documentId,
    canonicalId: chunk.canonicalId,
    chunkId: chunk.chunkId,
    headingPath: chunk.headingPath,
    score: Math.round(chunk.score * 100) / 100, // Round to 2 decimal places
    citation: buildCitation(chunk),
    excerpt: buildExcerpt(chunk.content),
  };
}

/** A suggested route derived from docs results */
export interface SuggestedRoute {
  route: string;
  title: string | null;
}

/**
 * Extract suggested routes from search results.
 * Only includes docs results (KB has no routes).
 * Returns unique routes, limited to maxCount.
 *
 * @param results - Search results
 * @param maxCount - Maximum number of routes (default 5)
 * @returns Array of suggested routes
 */
export function extractSuggestedRoutes(
  chunks: RetrievedChunk[],
  maxCount: number = 5
): SuggestedRoute[] {
  const seen = new Set<string>();
  const routes: SuggestedRoute[] = [];

  for (const chunk of chunks) {
    // Only docs have routes
    if (chunk.corpus !== 'docs' || !chunk.route) {
      continue;
    }

    if (seen.has(chunk.route)) {
      continue;
    }

    seen.add(chunk.route);
    routes.push({
      route: chunk.route,
      title: chunk.title,
    });

    if (routes.length >= maxCount) {
      break;
    }
  }

  return routes;
}
