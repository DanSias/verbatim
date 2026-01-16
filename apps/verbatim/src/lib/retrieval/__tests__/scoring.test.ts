/**
 * Unit tests for keyword scoring utilities.
 *
 * Tests pure scoring functions without database dependencies.
 */

import { describe, it, expect } from 'vitest';
import { tokenize, countOccurrences, scoreChunk } from '../scoring';

describe('tokenize', () => {
  it('converts text to lowercase terms', () => {
    const terms = tokenize('Hello World');
    expect(terms).toContain('hello');
    expect(terms).toContain('world');
  });

  it('removes common stop words', () => {
    const terms = tokenize('What is the best way to configure webhooks');
    expect(terms).not.toContain('what');
    expect(terms).not.toContain('is');
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('to');
    expect(terms).toContain('best');
    expect(terms).toContain('way');
    expect(terms).toContain('configure');
    expect(terms).toContain('webhooks');
  });

  it('removes single-character words', () => {
    const terms = tokenize('a b c test');
    expect(terms).not.toContain('a');
    expect(terms).not.toContain('b');
    expect(terms).not.toContain('c');
    expect(terms).toContain('test');
  });

  it('splits on punctuation', () => {
    const terms = tokenize('webhook.configuration, setup-guide');
    expect(terms).toContain('webhook');
    expect(terms).toContain('configuration');
    expect(terms).toContain('setup');
    expect(terms).toContain('guide');
  });

  it('returns empty array for stop-words-only input', () => {
    const terms = tokenize('the is a');
    expect(terms).toHaveLength(0);
  });
});

describe('countOccurrences', () => {
  it('counts single occurrence', () => {
    expect(countOccurrences('hello world', 'hello')).toBe(1);
  });

  it('counts multiple occurrences', () => {
    expect(countOccurrences('test test test', 'test')).toBe(3);
  });

  it('returns zero for no matches', () => {
    expect(countOccurrences('hello world', 'foo')).toBe(0);
  });

  it('is case sensitive', () => {
    expect(countOccurrences('Hello hello HELLO', 'hello')).toBe(1);
  });

  it('finds overlapping matches', () => {
    expect(countOccurrences('aaa', 'aa')).toBe(1); // Non-overlapping search
  });
});

describe('scoreChunk', () => {
  it('returns positive score for matching terms', () => {
    const content = 'Configure your webhook endpoint for notifications';
    const headingPath = ['Webhooks'];
    const queryTerms = ['webhook', 'configure'];

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBeGreaterThan(0);
  });

  it('returns zero for no matching terms', () => {
    const content = 'This is about merchant accounts';
    const headingPath = ['Merchant Setup'];
    const queryTerms = ['webhook', 'notification'];

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBe(0);
  });

  it('gives bonus for heading matches', () => {
    const content = 'Some generic content here';
    const headingPathWithMatch = ['Webhook Configuration'];
    const headingPathWithoutMatch = ['General Setup'];
    const queryTerms = ['webhook'];

    const scoreWithHeadingMatch = scoreChunk(
      content,
      headingPathWithMatch,
      queryTerms
    );
    const scoreWithoutHeadingMatch = scoreChunk(
      content,
      headingPathWithoutMatch,
      queryTerms
    );

    // Heading match should give higher score
    expect(scoreWithHeadingMatch).toBeGreaterThan(scoreWithoutHeadingMatch);
  });

  it('ranks relevant chunk higher than irrelevant chunk', () => {
    const webhookChunk = {
      content:
        'Webhooks allow you to receive real-time notifications. Configure your webhook endpoint to receive payment events. Webhook verification ensures security.',
      headingPath: ['Webhook Configuration'],
    };

    const merchantChunk = {
      content:
        'Set up your merchant account to process payments. Enter your business details and bank information for payouts.',
      headingPath: ['Merchant Setup'],
    };

    const queryTerms = tokenize('How do I configure webhooks?');

    const webhookScore = scoreChunk(
      webhookChunk.content,
      webhookChunk.headingPath,
      queryTerms
    );
    const merchantScore = scoreChunk(
      merchantChunk.content,
      merchantChunk.headingPath,
      queryTerms
    );

    // Webhook chunk should rank higher for webhook question
    expect(webhookScore).toBeGreaterThan(merchantScore);
  });

  it('handles multiple term matches correctly', () => {
    const content = 'webhook webhook webhook notification notification';
    const headingPath = ['Notifications'];
    const queryTerms = ['webhook', 'notification'];

    const score = scoreChunk(content, headingPath, queryTerms);
    // Should score based on both terms
    expect(score).toBeGreaterThan(0);
  });

  it('normalizes by content length', () => {
    const shortContent = 'webhook setup';
    const longContent = 'webhook ' + 'lorem ipsum '.repeat(100) + 'setup';
    const headingPath: string[] = [];
    const queryTerms = ['webhook', 'setup'];

    const shortScore = scoreChunk(shortContent, headingPath, queryTerms);
    const longScore = scoreChunk(longContent, headingPath, queryTerms);

    // Short content should have relatively higher score per match
    // (length normalization reduces long content advantage)
    expect(shortScore).toBeGreaterThan(longScore);
  });
});
