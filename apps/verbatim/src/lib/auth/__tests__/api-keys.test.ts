/**
 * Tests for API key utilities
 *
 * Tests generation, hashing, and verification of API keys.
 */

import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  isValidApiKeyFormat,
} from '../api-keys';

describe('API Key Utilities', () => {
  describe('generateApiKey', () => {
    it('generates a plaintext key with correct prefix', () => {
      const { plaintext } = generateApiKey();
      expect(plaintext).toMatch(/^vbm_[0-9a-f]{64}$/);
    });

    it('generates a hash', () => {
      const { hash } = generateApiKey();
      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 produces 64-char hex
    });

    it('generates unique keys on each call', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1.plaintext).not.toBe(key2.plaintext);
      expect(key1.hash).not.toBe(key2.hash);
    });

    it('hash matches plaintext key', () => {
      const { plaintext, hash } = generateApiKey();
      expect(verifyApiKey(plaintext, hash)).toBe(true);
    });
  });

  describe('hashApiKey', () => {
    it('produces consistent hash for same input', () => {
      const key = 'vbm_abc123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = hashApiKey('vbm_abc123');
      const hash2 = hashApiKey('vbm_xyz789');
      expect(hash1).not.toBe(hash2);
    });

    it('produces SHA-256 length output (64 hex chars)', () => {
      const hash = hashApiKey('vbm_test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyApiKey', () => {
    it('returns true for matching key and hash', () => {
      const key = 'vbm_abc123';
      const hash = hashApiKey(key);
      expect(verifyApiKey(key, hash)).toBe(true);
    });

    it('returns false for non-matching key and hash', () => {
      const key1 = 'vbm_abc123';
      const key2 = 'vbm_xyz789';
      const hash = hashApiKey(key1);
      expect(verifyApiKey(key2, hash)).toBe(false);
    });

    it('returns false for empty key', () => {
      const hash = hashApiKey('vbm_abc123');
      expect(verifyApiKey('', hash)).toBe(false);
    });

    it('returns false for empty hash', () => {
      expect(verifyApiKey('vbm_abc123', '')).toBe(false);
    });

    it('works with generated keys', () => {
      const { plaintext, hash } = generateApiKey();
      expect(verifyApiKey(plaintext, hash)).toBe(true);
    });
  });

  describe('isValidApiKeyFormat', () => {
    it('accepts valid API key format', () => {
      const { plaintext } = generateApiKey();
      expect(isValidApiKeyFormat(plaintext)).toBe(true);
    });

    it('accepts lowercase hex', () => {
      const key = 'vbm_' + 'a'.repeat(64);
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it('accepts uppercase hex', () => {
      const key = 'vbm_' + 'A'.repeat(64);
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it('accepts mixed case hex', () => {
      const key = 'vbm_' + 'aAbBcC'.repeat(10) + 'aAbB';
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it('rejects key without prefix', () => {
      const key = 'a'.repeat(64);
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects key with wrong prefix', () => {
      const key = 'api_' + 'a'.repeat(64);
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects key that is too short', () => {
      const key = 'vbm_' + 'a'.repeat(32);
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects key that is too long', () => {
      const key = 'vbm_' + 'a'.repeat(128);
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects key with non-hex characters', () => {
      const key = 'vbm_' + 'g'.repeat(64);
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects key with special characters', () => {
      const key = 'vbm_' + 'a'.repeat(60) + '!@#$';
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidApiKeyFormat('')).toBe(false);
    });
  });
});
