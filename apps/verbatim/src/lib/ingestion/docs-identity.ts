/**
 * Docs Identity Utilities
 *
 * Implements route-first identity system for docs corpus.
 * See ARCHITECTURE.md Section 4.3 and Section 6.2.
 *
 * CRITICAL: Canonical identity is the route, not the filename.
 * This prevents identity collisions from multiple page.mdx files.
 */

/**
 * Derive the docs route from a relative file path.
 *
 * Examples (from ARCHITECTURE.md Section 6.2):
 * - page.mdx at root → /
 * - certification/page.mdx → /certification
 * - guides/webhooks/page.mdx → /guides/webhooks
 *
 * @param relativePath - The relative path to the page.mdx file
 * @returns The docs route
 */
export function deriveRoute(relativePath: string): string {
  // Normalize path separators
  const normalized = relativePath.replace(/\\/g, '/');

  // Remove trailing /page.mdx or page.mdx
  let route = normalized.replace(/\/?page\.mdx$/i, '');

  // Ensure route starts with /
  if (!route.startsWith('/')) {
    route = '/' + route;
  }

  // Handle root case: empty path becomes /
  if (route === '/') {
    return '/';
  }

  // Remove trailing slash if present
  return route.replace(/\/$/, '');
}

/**
 * Build the canonical ID for a docs document.
 *
 * Format: docs:/some/route
 * See ARCHITECTURE.md Section 4.3.
 *
 * @param route - The docs route
 * @returns The canonical ID
 */
export function buildCanonicalId(route: string): string {
  return `docs:${route}`;
}

/**
 * Humanize a folder name for use as a fallback title.
 *
 * Examples:
 * - merchant-accounts → Merchant Accounts
 * - getting_started → Getting Started
 * - api → API
 *
 * @param folderName - The folder name to humanize
 * @returns Humanized title
 */
export function humanizeFolderName(folderName: string): string {
  return folderName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Extract the folder name from a route for title fallback.
 *
 * @param route - The docs route
 * @returns The last segment of the route, or null for root
 */
export function extractFolderName(route: string): string | null {
  if (route === '/') {
    return null;
  }

  const segments = route.split('/').filter(Boolean);
  return segments[segments.length - 1] || null;
}

/**
 * Derive the display title with full fallback chain.
 * Priority (from ARCHITECTURE.md Section 6.2):
 * 1. frontmatter title
 * 2. first H1
 * 3. folder name humanized
 *
 * @param frontmatterTitle - Title from frontmatter
 * @param firstH1 - First H1 heading text
 * @param route - The docs route for folder name fallback
 * @returns The display title
 */
export function deriveTitle(
  frontmatterTitle: string | null,
  firstH1: string | null,
  route: string
): string {
  // Priority 1: frontmatter title
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  // Priority 2: first H1
  if (firstH1) {
    return firstH1;
  }

  // Priority 3: folder name humanized
  const folderName = extractFolderName(route);
  if (folderName) {
    return humanizeFolderName(folderName);
  }

  // Ultimate fallback for root
  return 'Home';
}

/**
 * Validate that a file path is a valid docs page.
 * Only **/page.mdx files are valid for docs corpus.
 *
 * @param relativePath - The relative file path
 * @returns True if the path is a valid docs page
 */
export function isValidDocsPage(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('/page.mdx') || normalized === 'page.mdx';
}
