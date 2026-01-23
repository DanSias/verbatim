/**
 * Tests for email allowlist helpers
 *
 * Tests parsing of env variables and email validation logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseAllowedDomains,
  parseAllowedEmails,
  isEmailAllowed,
} from '../allowlist';

describe('Allowlist Helpers', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('parseAllowedDomains', () => {
    it('returns empty array when env is not set', () => {
      delete process.env.AUTH_ALLOWED_DOMAINS;
      expect(parseAllowedDomains()).toEqual([]);
    });

    it('returns empty array when env is empty string', () => {
      process.env.AUTH_ALLOWED_DOMAINS = '';
      expect(parseAllowedDomains()).toEqual([]);
    });

    it('returns empty array when env is only whitespace', () => {
      process.env.AUTH_ALLOWED_DOMAINS = '   ';
      expect(parseAllowedDomains()).toEqual([]);
    });

    it('parses single domain', () => {
      process.env.AUTH_ALLOWED_DOMAINS = 'example.com';
      expect(parseAllowedDomains()).toEqual(['example.com']);
    });

    it('parses multiple domains', () => {
      process.env.AUTH_ALLOWED_DOMAINS = 'example.com,company.org,partner.io';
      expect(parseAllowedDomains()).toEqual(['example.com', 'company.org', 'partner.io']);
    });

    it('trims whitespace around domains', () => {
      process.env.AUTH_ALLOWED_DOMAINS = '  example.com  ,  company.org  ';
      expect(parseAllowedDomains()).toEqual(['example.com', 'company.org']);
    });

    it('normalizes domains to lowercase', () => {
      process.env.AUTH_ALLOWED_DOMAINS = 'Example.COM,COMPANY.ORG';
      expect(parseAllowedDomains()).toEqual(['example.com', 'company.org']);
    });

    it('filters out empty entries from trailing commas', () => {
      process.env.AUTH_ALLOWED_DOMAINS = 'example.com,,company.org,';
      expect(parseAllowedDomains()).toEqual(['example.com', 'company.org']);
    });
  });

  describe('parseAllowedEmails', () => {
    it('returns empty array when env is not set', () => {
      delete process.env.AUTH_ALLOWED_EMAILS;
      expect(parseAllowedEmails()).toEqual([]);
    });

    it('returns empty array when env is empty string', () => {
      process.env.AUTH_ALLOWED_EMAILS = '';
      expect(parseAllowedEmails()).toEqual([]);
    });

    it('returns empty array when env is only whitespace', () => {
      process.env.AUTH_ALLOWED_EMAILS = '   ';
      expect(parseAllowedEmails()).toEqual([]);
    });

    it('parses single email', () => {
      process.env.AUTH_ALLOWED_EMAILS = 'user@example.com';
      expect(parseAllowedEmails()).toEqual(['user@example.com']);
    });

    it('parses multiple emails', () => {
      process.env.AUTH_ALLOWED_EMAILS = 'admin@example.com,user@company.org';
      expect(parseAllowedEmails()).toEqual(['admin@example.com', 'user@company.org']);
    });

    it('trims whitespace around emails', () => {
      process.env.AUTH_ALLOWED_EMAILS = '  user@example.com  ,  admin@company.org  ';
      expect(parseAllowedEmails()).toEqual(['user@example.com', 'admin@company.org']);
    });

    it('normalizes emails to lowercase', () => {
      process.env.AUTH_ALLOWED_EMAILS = 'User@Example.COM,ADMIN@COMPANY.ORG';
      expect(parseAllowedEmails()).toEqual(['user@example.com', 'admin@company.org']);
    });

    it('filters out empty entries from trailing commas', () => {
      process.env.AUTH_ALLOWED_EMAILS = 'user@example.com,,admin@company.org,';
      expect(parseAllowedEmails()).toEqual(['user@example.com', 'admin@company.org']);
    });
  });

  describe('isEmailAllowed', () => {
    describe('when both allowlists are empty (OSS mode)', () => {
      beforeEach(() => {
        delete process.env.AUTH_ALLOWED_DOMAINS;
        delete process.env.AUTH_ALLOWED_EMAILS;
      });

      it('allows any valid email', () => {
        expect(isEmailAllowed('anyone@anywhere.com')).toBe(true);
      });

      it('allows emails with various domains', () => {
        expect(isEmailAllowed('user@gmail.com')).toBe(true);
        expect(isEmailAllowed('admin@company.io')).toBe(true);
      });

      it('rejects null email', () => {
        expect(isEmailAllowed(null)).toBe(false);
      });

      it('rejects undefined email', () => {
        expect(isEmailAllowed(undefined)).toBe(false);
      });

      it('rejects empty string email', () => {
        expect(isEmailAllowed('')).toBe(false);
      });

      it('rejects whitespace-only email', () => {
        expect(isEmailAllowed('   ')).toBe(false);
      });
    });

    describe('when domain allowlist is set', () => {
      beforeEach(() => {
        process.env.AUTH_ALLOWED_DOMAINS = 'company.com,partner.org';
        delete process.env.AUTH_ALLOWED_EMAILS;
      });

      it('allows email from allowed domain', () => {
        expect(isEmailAllowed('user@company.com')).toBe(true);
      });

      it('allows email from any allowed domain', () => {
        expect(isEmailAllowed('admin@partner.org')).toBe(true);
      });

      it('rejects email from non-allowed domain', () => {
        expect(isEmailAllowed('user@other.com')).toBe(false);
      });

      it('is case-insensitive for email matching', () => {
        expect(isEmailAllowed('User@COMPANY.com')).toBe(true);
        expect(isEmailAllowed('ADMIN@Partner.ORG')).toBe(true);
      });

      it('rejects null email', () => {
        expect(isEmailAllowed(null)).toBe(false);
      });
    });

    describe('when email allowlist is set', () => {
      beforeEach(() => {
        delete process.env.AUTH_ALLOWED_DOMAINS;
        process.env.AUTH_ALLOWED_EMAILS = 'admin@example.com,special@any.org';
      });

      it('allows email in allowlist', () => {
        expect(isEmailAllowed('admin@example.com')).toBe(true);
      });

      it('allows any email in allowlist', () => {
        expect(isEmailAllowed('special@any.org')).toBe(true);
      });

      it('rejects email not in allowlist', () => {
        expect(isEmailAllowed('other@example.com')).toBe(false);
      });

      it('is case-insensitive for email matching', () => {
        expect(isEmailAllowed('ADMIN@EXAMPLE.COM')).toBe(true);
        expect(isEmailAllowed('Special@Any.ORG')).toBe(true);
      });
    });

    describe('when both domain and email allowlists are set', () => {
      beforeEach(() => {
        process.env.AUTH_ALLOWED_DOMAINS = 'company.com';
        process.env.AUTH_ALLOWED_EMAILS = 'partner@external.org';
      });

      it('allows email from allowed domain', () => {
        expect(isEmailAllowed('employee@company.com')).toBe(true);
      });

      it('allows email in email allowlist', () => {
        expect(isEmailAllowed('partner@external.org')).toBe(true);
      });

      it('rejects email not matching either allowlist', () => {
        expect(isEmailAllowed('random@other.com')).toBe(false);
      });

      it('rejects email from external domain not in email list', () => {
        expect(isEmailAllowed('other@external.org')).toBe(false);
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        process.env.AUTH_ALLOWED_DOMAINS = 'example.com';
        delete process.env.AUTH_ALLOWED_EMAILS;
      });

      it('handles email with subdomain correctly', () => {
        // subdomain.example.com should NOT match example.com (strict domain match)
        expect(isEmailAllowed('user@subdomain.example.com')).toBe(false);
      });

      it('handles email with multiple @ symbols', () => {
        // Uses lastIndexOf('@'), so this should work
        expect(isEmailAllowed('weird@email@example.com')).toBe(true);
      });

      it('trims whitespace from input email', () => {
        expect(isEmailAllowed('  user@example.com  ')).toBe(true);
      });
    });
  });
});
