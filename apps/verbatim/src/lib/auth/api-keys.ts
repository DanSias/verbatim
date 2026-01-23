/**
 * API Key Utilities
 *
 * Pure functions for API key generation, hashing, and verification.
 * Used for widget and API authentication (Phase 9.4).
 *
 * Security model:
 * - API keys are high-entropy random strings (32 bytes = 256 bits)
 * - Only hashed keys are stored in database
 * - Plaintext key shown once on creation
 * - SHA-256 used for deterministic hashing
 */

import { createHash, randomBytes } from 'crypto';

/**
 * API key format: vbm_<32-byte-hex>
 * Example: vbm_a1b2c3d4e5f6...
 */
const API_KEY_PREFIX = 'vbm_';
const API_KEY_BYTES = 32; // 256 bits of entropy

/**
 * Generate a new API key
 * Returns plaintext key (to show user) and hash (to store in DB)
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  // Generate random bytes
  const randomBytesBuffer = randomBytes(API_KEY_BYTES);
  const randomHex = randomBytesBuffer.toString('hex');

  // Format: vbm_<hex>
  const plaintext = API_KEY_PREFIX + randomHex;

  // Hash for storage
  const hash = hashApiKey(plaintext);

  return { plaintext, hash };
}

/**
 * Hash an API key for storage
 * Uses SHA-256 for deterministic, secure hashing
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key against a stored hash
 * Constant-time comparison to prevent timing attacks
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);

  // Constant-time comparison
  if (keyHash.length !== hash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < keyHash.length; i++) {
    result |= keyHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate API key format
 * Checks if key matches expected format (vbm_<64-char-hex>)
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  const hexPart = key.slice(API_KEY_PREFIX.length);

  // Should be exactly 64 hex characters (32 bytes)
  if (hexPart.length !== API_KEY_BYTES * 2) {
    return false;
  }

  // Should only contain hex characters
  return /^[0-9a-f]+$/i.test(hexPart);
}
