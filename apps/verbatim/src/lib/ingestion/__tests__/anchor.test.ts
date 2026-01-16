/**
 * Unit tests for anchor/slug generation.
 *
 * Tests GitHub-style anchor slugging for linkable citations.
 * See ARCHITECTURE.md Section 8.3.
 */

import { describe, it, expect } from 'vitest';
import { generateAnchor, generateAnchors } from '../anchor';

describe('generateAnchor', () => {
  it('converts title case headings to lowercase hyphenated', () => {
    expect(generateAnchor('Merchant Account Setup')).toBe('merchant-account-setup');
  });

  it('handles sentence case headings', () => {
    expect(generateAnchor('Signature verification failing')).toBe(
      'signature-verification-failing'
    );
  });

  it('handles ampersands and special characters', () => {
    // GitHub slugger removes the ampersand but keeps hyphens
    expect(generateAnchor('Limits & Retries')).toBe('limits--retries');
  });

  it('handles punctuation removal', () => {
    expect(generateAnchor("What's new?")).toBe('whats-new');
    expect(generateAnchor('FAQ: Common Questions')).toBe('faq-common-questions');
  });

  it('handles numbers in headings', () => {
    expect(generateAnchor('Step 1: Getting Started')).toBe('step-1-getting-started');
    expect(generateAnchor('API v2 Endpoints')).toBe('api-v2-endpoints');
  });

  it('handles all lowercase input', () => {
    expect(generateAnchor('setup')).toBe('setup');
    expect(generateAnchor('webhook configuration')).toBe('webhook-configuration');
  });

  it('handles multiple spaces', () => {
    expect(generateAnchor('Multiple   Spaces   Here')).toBe('multiple---spaces---here');
  });
});

describe('generateAnchors', () => {
  it('generates unique anchors for duplicate headings', () => {
    const headings = ['Setup', 'Configuration', 'Setup'];
    const anchors = generateAnchors(headings);

    expect(anchors[0]).toBe('setup');
    expect(anchors[1]).toBe('configuration');
    expect(anchors[2]).toBe('setup-1'); // Duplicate gets -1 suffix
  });

  it('handles multiple duplicates', () => {
    const headings = ['Overview', 'Overview', 'Overview'];
    const anchors = generateAnchors(headings);

    expect(anchors[0]).toBe('overview');
    expect(anchors[1]).toBe('overview-1');
    expect(anchors[2]).toBe('overview-2');
  });

  it('handles empty array', () => {
    expect(generateAnchors([])).toEqual([]);
  });
});
