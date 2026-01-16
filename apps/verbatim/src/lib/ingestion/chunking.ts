/**
 * Chunking Utilities
 *
 * Implements corpus-aware H2-based chunking.
 * See ARCHITECTURE.md Section 8.
 *
 * Chunk boundary rules for docs:
 * - Chunk boundary = H2 (##)
 * - H1 is page-level context (not a chunk boundary)
 * - H3+ remain inside the H2 chunk
 *
 * Each chunk stores:
 * - headingPath: breadcrumb [H1?, H2]
 * - anchor: GitHub-style slug for linkable citations
 * - content: the chunk text
 */

import GithubSlugger from 'github-slugger';

/** Configuration for chunking */
export interface ChunkingConfig {
  /** Maximum characters per chunk (default: 4000) */
  maxChars: number;
  /** Overlap characters for size-split windows (default: 400) */
  overlapChars: number;
}

/** Default chunking configuration from ARCHITECTURE.md Section 8.4 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxChars: 4000,
  overlapChars: 400,
};

/** A chunk ready for storage */
export interface Chunk {
  /** Breadcrumb for display/debugging, e.g., ["Page Title", "Section Title"] */
  headingPath: string[];
  /** GitHub-style anchor for linkable citations (docs only) */
  anchor: string | null;
  /** The chunk content */
  content: string;
  /** Chunk index within the document */
  chunkIndex: number;
}

/** Intermediate representation of an H2 section */
interface Section {
  /** The H2 heading text */
  heading: string;
  /** The H2 anchor (GitHub-style slug) */
  anchor: string;
  /** Full content of the section (including the H2 line and all nested content) */
  content: string;
}

/**
 * Chunk normalized MDX content using H2 boundaries.
 *
 * @param normalizedContent - The normalized text content (MDX stripped)
 * @param h1Title - The H1 title (page context), if present
 * @param config - Chunking configuration
 * @returns Array of chunks
 */
export function chunkDocsContent(
  normalizedContent: string,
  h1Title: string | null,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): Chunk[] {
  const sections = splitByH2(normalizedContent);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionChunks = chunkSection(section, h1Title, config, chunkIndex);
    chunks.push(...sectionChunks);
    chunkIndex += sectionChunks.length;
  }

  return chunks;
}

/**
 * Split content by H2 headings.
 * Content before the first H2 is included as a section with no heading.
 */
function splitByH2(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  const slugger = new GithubSlugger();

  let currentSection: Section | null = null;
  let preambleLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);

    if (h2Match) {
      // Found an H2 - save current section and start new one
      if (currentSection) {
        sections.push(currentSection);
      } else if (preambleLines.length > 0) {
        // Handle content before first H2 (preamble)
        sections.push({
          heading: '',
          anchor: '',
          content: preambleLines.join('\n').trim(),
        });
      }

      const headingText = h2Match[1].trim();
      currentSection = {
        heading: headingText,
        anchor: slugger.slug(headingText),
        content: line,
      };
    } else if (currentSection) {
      // Add line to current section
      currentSection.content += '\n' + line;
    } else {
      // Preamble (content before first H2)
      preambleLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  } else if (preambleLines.length > 0) {
    // Document with no H2s - entire content is preamble
    sections.push({
      heading: '',
      anchor: '',
      content: preambleLines.join('\n').trim(),
    });
  }

  // Trim content in all sections
  return sections.map((s) => ({
    ...s,
    content: s.content.trim(),
  }));
}

/**
 * Chunk a single H2 section, applying size splitting if needed.
 * All size-split windows share the same anchor.
 */
function chunkSection(
  section: Section,
  h1Title: string | null,
  config: ChunkingConfig,
  startIndex: number
): Chunk[] {
  const { maxChars, overlapChars } = config;
  const content = section.content;

  // Build heading path
  const headingPath: string[] = [];
  if (h1Title) {
    headingPath.push(h1Title);
  }
  if (section.heading) {
    headingPath.push(section.heading);
  }

  // Determine anchor (null for preamble sections)
  const anchor = section.anchor || null;

  // If content fits in one chunk, return it directly
  if (content.length <= maxChars) {
    return [
      {
        headingPath,
        anchor,
        content,
        chunkIndex: startIndex,
      },
    ];
  }

  // Size-split into overlapping windows
  return splitIntoWindows(content, headingPath, anchor, maxChars, overlapChars, startIndex);
}

/**
 * Split content into overlapping windows.
 * All windows share the same anchor (they point to the same H2 section).
 */
function splitIntoWindows(
  content: string,
  headingPath: string[],
  anchor: string | null,
  maxChars: number,
  overlapChars: number,
  startIndex: number
): Chunk[] {
  const chunks: Chunk[] = [];
  let position = 0;
  let chunkIndex = startIndex;

  while (position < content.length) {
    // Calculate end position for this window
    let end = Math.min(position + maxChars, content.length);

    // Try to break at a paragraph or sentence boundary
    if (end < content.length) {
      const breakPoint = findBreakPoint(content, position, end);
      if (breakPoint > position) {
        end = breakPoint;
      }
    }

    const windowContent = content.slice(position, end).trim();

    if (windowContent) {
      chunks.push({
        headingPath,
        anchor,
        content: windowContent,
        chunkIndex,
      });
      chunkIndex++;
    }

    // Move position forward, accounting for overlap
    if (end >= content.length) {
      break;
    }

    position = end - overlapChars;

    // Ensure we make progress
    if (position <= chunks[chunks.length - 1]?.chunkIndex) {
      position = end;
    }
  }

  return chunks;
}

/**
 * Find a good break point (paragraph or sentence boundary).
 */
function findBreakPoint(content: string, start: number, maxEnd: number): number {
  // Look for paragraph break (double newline)
  const paragraphBreak = content.lastIndexOf('\n\n', maxEnd);
  if (paragraphBreak > start + 500) {
    return paragraphBreak + 2;
  }

  // Look for sentence break (. followed by space or newline)
  const region = content.slice(start, maxEnd);
  const sentenceBreaks = [...region.matchAll(/\.\s/g)];

  if (sentenceBreaks.length > 0) {
    const lastBreak = sentenceBreaks[sentenceBreaks.length - 1];
    if (lastBreak.index && lastBreak.index > 500) {
      return start + lastBreak.index + 2;
    }
  }

  // Look for any newline
  const newlineBreak = content.lastIndexOf('\n', maxEnd);
  if (newlineBreak > start + 500) {
    return newlineBreak + 1;
  }

  // No good break point found, use maxEnd
  return maxEnd;
}

/**
 * Generate the citation URL for a chunk.
 *
 * Format: {route}#{anchor}
 * Example: /merchant-accounts#merchant-account-setup
 *
 * @param route - The document route
 * @param anchor - The chunk anchor (may be null for preamble)
 * @returns The citation URL
 */
export function buildCitationUrl(route: string, anchor: string | null): string {
  if (!anchor) {
    return route;
  }
  return `${route}#${anchor}`;
}
