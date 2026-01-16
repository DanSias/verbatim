/**
 * Content Hashing Utilities
 *
 * Computes content hashes for change detection during re-ingestion.
 * See ARCHITECTURE.md Section 6.5.
 */

import { createHash } from 'crypto';

/**
 * Compute a SHA-256 hash of the content.
 *
 * @param content - The content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
