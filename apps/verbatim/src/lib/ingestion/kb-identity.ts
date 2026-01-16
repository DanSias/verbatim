/**
 * KB Identity Utilities
 *
 * Implements path-based identity system for KB corpus.
 * See ARCHITECTURE.md Section 4.3 and Section 6.3.
 *
 * KB identity rules:
 * - Canonical ID is based on relative path: kb:relative/path.md
 * - KB documents have NO route (route = null)
 * - KB documents do NOT generate navigation links
 */

/**
 * Build the canonical ID for a KB document.
 *
 * Format: kb:relative/path/to/article.md
 * See ARCHITECTURE.md Section 6.3.
 *
 * @param sourcePath - The relative path to the markdown file
 * @returns The canonical ID
 */
export function buildKbCanonicalId(sourcePath: string): string {
  // Normalize path separators
  const normalized = sourcePath.replace(/\\/g, '/');
  return `kb:${normalized}`;
}

/**
 * Validate that a file path is a valid KB article.
 * All .md files are valid for KB corpus.
 *
 * @param relativePath - The relative file path
 * @returns True if the path is a valid KB article
 */
export function isValidKbArticle(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('.md');
}

/**
 * Derive the display title for a KB article.
 *
 * Priority:
 * 1. frontmatter title
 * 2. first H1
 * 3. filename without extension (humanized)
 *
 * @param frontmatterTitle - Title from frontmatter
 * @param firstH1 - First H1 heading text
 * @param sourcePath - The source path for filename fallback
 * @returns The display title
 */
export function deriveKbTitle(
  frontmatterTitle: string | null,
  firstH1: string | null,
  sourcePath: string
): string {
  // Priority 1: frontmatter title
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  // Priority 2: first H1
  if (firstH1) {
    return firstH1;
  }

  // Priority 3: filename without extension, humanized
  const filename = sourcePath.split('/').pop() || sourcePath;
  const nameWithoutExt = filename.replace(/\.md$/i, '');
  return humanizeFilename(nameWithoutExt);
}

/**
 * Humanize a filename for use as a fallback title.
 *
 * Examples:
 * - why-was-i-held → Why Was I Held
 * - getting_started → Getting Started
 * - FAQ → FAQ
 *
 * @param filename - The filename to humanize
 * @returns Humanized title
 */
function humanizeFilename(filename: string): string {
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}
