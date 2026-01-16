/**
 * Anchor / Slug Generation
 *
 * Generates GitHub-style anchors for linkable citations.
 * See ARCHITECTURE.md Section 8.3.
 *
 * Uses the same slugging behavior as the docs site (GitHub-style).
 */

import GithubSlugger from 'github-slugger';

/**
 * Generate a GitHub-style anchor slug from a heading.
 *
 * Examples:
 * - "Merchant Account Setup" => "merchant-account-setup"
 * - "Signature verification failing" => "signature-verification-failing"
 * - "Limits & Retries" => "limits--retries"
 *
 * @param heading - The heading text
 * @returns The anchor slug
 */
export function generateAnchor(heading: string): string {
  const slugger = new GithubSlugger();
  return slugger.slug(heading);
}

/**
 * Generate multiple anchors with duplicate handling.
 * GithubSlugger automatically handles duplicates by appending -1, -2, etc.
 *
 * @param headings - Array of heading texts
 * @returns Array of anchor slugs
 */
export function generateAnchors(headings: string[]): string[] {
  const slugger = new GithubSlugger();
  return headings.map((h) => slugger.slug(h));
}
