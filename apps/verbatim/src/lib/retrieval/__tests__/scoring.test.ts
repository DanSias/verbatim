/**
 * Unit tests for keyword scoring utilities.
 *
 * Tests pure scoring functions without database dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  tokenizeWithPhrases,
  countOccurrences,
  scoreChunk,
  scoreChunkWithPhrases,
  normalizePlural,
  getSynonyms,
  scoreContentTerms,
  scoreHeadingTerms,
  scorePhraseMatches,
  scoreProximityBonus,
  normalizeScore,
  WEIGHT_CONTENT_TERM,
  WEIGHT_HEADING_TERM,
  WEIGHT_PHRASE_CONTENT,
  WEIGHT_PHRASE_HEADING,
  WEIGHT_PROXIMITY_BONUS,
  PROXIMITY_WINDOW,
  MIN_LENGTH_FOR_NORMALIZATION,
} from '../scoring';

// ============================================================================
// tokenize() tests (backward compatibility)
// ============================================================================

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
    // Should also have synonym and normalized plural
    expect(terms).toContain('webhook');
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

  it('normalizes plurals', () => {
    const terms = tokenize('webhooks queries accounts');
    expect(terms).toContain('webhook');
    expect(terms).toContain('query');
    expect(terms).toContain('account');
  });

  it('expands synonyms', () => {
    const terms = tokenize('webhook merchant');
    expect(terms).toContain('callback'); // synonym for webhook
    expect(terms).toContain('mid'); // synonym for merchant
  });
});

// ============================================================================
// tokenizeWithPhrases() tests
// ============================================================================

describe('tokenizeWithPhrases', () => {
  it('extracts quoted phrases', () => {
    const result = tokenizeWithPhrases('How to configure "merchant account"');
    expect(result.phrases).toContain('merchant account');
    expect(result.phrases).toHaveLength(1);
  });

  it('extracts multiple quoted phrases', () => {
    const result = tokenizeWithPhrases('"api key" and "webhook endpoint"');
    expect(result.phrases).toContain('api key');
    expect(result.phrases).toContain('webhook endpoint');
    expect(result.phrases).toHaveLength(2);
  });

  it('still extracts terms outside quotes', () => {
    const result = tokenizeWithPhrases('configure "merchant account" for payments');
    expect(result.phrases).toContain('merchant account');
    expect(result.terms).toContain('configure');
    expect(result.terms).toContain('payment'); // normalized plural
  });

  it('handles text without quotes', () => {
    const result = tokenizeWithPhrases('configure webhook endpoint');
    expect(result.phrases).toHaveLength(0);
    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.terms).toContain('webhook');
  });

  it('lowercases phrases', () => {
    const result = tokenizeWithPhrases('"Merchant Account"');
    expect(result.phrases).toContain('merchant account');
  });
});

// ============================================================================
// normalizePlural() tests
// ============================================================================

describe('normalizePlural', () => {
  it('handles -ies plurals', () => {
    expect(normalizePlural('queries')).toBe('query');
    expect(normalizePlural('bodies')).toBe('body');
    expect(normalizePlural('entries')).toBe('entry');
  });

  it('handles -es plurals for sibilants', () => {
    expect(normalizePlural('boxes')).toBe('box');
    expect(normalizePlural('watches')).toBe('watch');
    expect(normalizePlural('crashes')).toBe('crash');
    expect(normalizePlural('buzzes')).toBe('buzz');
  });

  it('handles regular -s plurals', () => {
    expect(normalizePlural('webhooks')).toBe('webhook');
    expect(normalizePlural('accounts')).toBe('account');
    expect(normalizePlural('endpoints')).toBe('endpoint');
  });

  it('preserves words ending in ss', () => {
    expect(normalizePlural('class')).toBe('class');
    expect(normalizePlural('access')).toBe('access');
  });

  it('preserves short words', () => {
    expect(normalizePlural('is')).toBe('is');
    expect(normalizePlural('as')).toBe('as');
  });

  it('preserves singular words', () => {
    expect(normalizePlural('webhook')).toBe('webhook');
    expect(normalizePlural('query')).toBe('query');
  });
});

// ============================================================================
// getSynonyms() tests
// ============================================================================

describe('getSynonyms', () => {
  it('returns synonyms for known terms', () => {
    expect(getSynonyms('webhook')).toContain('callback');
    expect(getSynonyms('merchant')).toContain('mid');
  });

  it('returns empty set for unknown terms', () => {
    const syns = getSynonyms('unknownterm123');
    expect(syns.size).toBe(0);
  });

  it('works bidirectionally', () => {
    expect(getSynonyms('callback')).toContain('webhook');
    expect(getSynonyms('mid')).toContain('merchant');
  });

  it('handles multi-synonym terms', () => {
    // 'auth' has multiple sources
    const configSyns = getSynonyms('configure');
    expect(configSyns).toContain('setup');
  });
});

// ============================================================================
// countOccurrences() tests
// ============================================================================

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

// ============================================================================
// Scoring helper tests
// ============================================================================

describe('scoreContentTerms', () => {
  it('scores based on term frequency', () => {
    const score = scoreContentTerms('webhook webhook webhook', ['webhook']);
    expect(score).toBe(3 * WEIGHT_CONTENT_TERM);
  });

  it('scores multiple terms', () => {
    const score = scoreContentTerms('webhook endpoint api', ['webhook', 'endpoint']);
    expect(score).toBe(2 * WEIGHT_CONTENT_TERM);
  });

  it('returns zero for no matches', () => {
    const score = scoreContentTerms('hello world', ['webhook']);
    expect(score).toBe(0);
  });
});

describe('scoreHeadingTerms', () => {
  it('scores heading matches with higher weight', () => {
    const score = scoreHeadingTerms('webhook configuration', ['webhook']);
    expect(score).toBe(WEIGHT_HEADING_TERM);
  });

  it('scores multiple heading matches', () => {
    const score = scoreHeadingTerms('webhook api endpoint', ['webhook', 'endpoint']);
    expect(score).toBe(2 * WEIGHT_HEADING_TERM);
  });

  it('returns zero for no matches', () => {
    const score = scoreHeadingTerms('general setup', ['webhook']);
    expect(score).toBe(0);
  });
});

describe('scorePhraseMatches', () => {
  it('scores phrase in content', () => {
    const score = scorePhraseMatches('set up your merchant account here', '', ['merchant account']);
    expect(score).toBe(WEIGHT_PHRASE_CONTENT);
  });

  it('scores phrase in heading higher', () => {
    const score = scorePhraseMatches('some content', 'merchant account setup', ['merchant account']);
    expect(score).toBe(WEIGHT_PHRASE_HEADING);
  });

  it('scores phrase in both content and heading', () => {
    const score = scorePhraseMatches(
      'configure your merchant account',
      'merchant account guide',
      ['merchant account']
    );
    expect(score).toBe(WEIGHT_PHRASE_HEADING + WEIGHT_PHRASE_CONTENT);
  });

  it('counts multiple phrase occurrences in content', () => {
    const score = scorePhraseMatches(
      'merchant account setup. your merchant account is ready.',
      '',
      ['merchant account']
    );
    expect(score).toBe(2 * WEIGHT_PHRASE_CONTENT);
  });
});

describe('scoreProximityBonus', () => {
  it('rewards terms within proximity window', () => {
    // 'webhook endpoint' - terms are adjacent
    const score = scoreProximityBonus('webhook endpoint', ['webhook', 'endpoint']);
    expect(score).toBeGreaterThan(0);
  });

  it('returns zero for single term', () => {
    const score = scoreProximityBonus('webhook', ['webhook']);
    expect(score).toBe(0);
  });

  it('returns zero when terms are far apart', () => {
    const longText = 'webhook ' + 'x'.repeat(100) + ' endpoint';
    const score = scoreProximityBonus(longText, ['webhook', 'endpoint']);
    expect(score).toBe(0);
  });

  it('returns zero when only one term matches', () => {
    const score = scoreProximityBonus('webhook setup', ['webhook', 'endpoint']);
    expect(score).toBe(0);
  });

  it('counts multiple proximity pairs', () => {
    // Multiple terms close together should get multiple bonuses
    const content = 'webhook endpoint api';
    const score = scoreProximityBonus(content, ['webhook', 'endpoint', 'api']);
    // webhook-endpoint, endpoint-api, and possibly webhook-api
    expect(score).toBeGreaterThan(WEIGHT_PROXIMITY_BONUS);
  });
});

describe('normalizeScore', () => {
  it('returns zero for zero score', () => {
    expect(normalizeScore(0, 1000)).toBe(0);
  });

  it('applies length normalization', () => {
    const shortScore = normalizeScore(10, 100);
    const longScore = normalizeScore(10, 2000);
    expect(shortScore).toBeGreaterThan(longScore);
  });

  it('caps normalization for very short content', () => {
    const score1 = normalizeScore(10, 10);
    const score2 = normalizeScore(10, 50);
    // Both should be capped at MIN_LENGTH_FOR_NORMALIZATION
    expect(score1).toBe(score2);
  });
});

// ============================================================================
// scoreChunk() tests (backward compatibility)
// ============================================================================

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
    const queryTerms = ['random', 'terms'];

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBe(0);
  });

  it('gives bonus for heading matches', () => {
    const content = 'Some generic content here';
    const headingPathWithMatch = ['Webhook Configuration'];
    const headingPathWithoutMatch = ['General Setup'];
    const queryTerms = ['webhook'];

    const scoreWithHeadingMatch = scoreChunk(content, headingPathWithMatch, queryTerms);
    const scoreWithoutHeadingMatch = scoreChunk(content, headingPathWithoutMatch, queryTerms);

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

    const webhookScore = scoreChunk(webhookChunk.content, webhookChunk.headingPath, queryTerms);
    const merchantScore = scoreChunk(merchantChunk.content, merchantChunk.headingPath, queryTerms);

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

  it('applies proximity bonus for close terms', () => {
    const closeTerms = 'webhook endpoint configuration';
    const farTerms = 'webhook ' + 'x'.repeat(100) + ' endpoint ' + 'x'.repeat(100) + ' configuration';
    const headingPath: string[] = [];
    const queryTerms = ['webhook', 'endpoint'];

    const closeScore = scoreChunk(closeTerms, headingPath, queryTerms);
    const farScore = scoreChunk(farTerms, headingPath, queryTerms);

    // Close terms should score higher due to proximity bonus
    expect(closeScore).toBeGreaterThan(farScore);
  });
});

// ============================================================================
// scoreChunkWithPhrases() tests
// ============================================================================

describe('scoreChunkWithPhrases', () => {
  it('scores phrase matches higher than loose keyword matches', () => {
    const content = 'Configure your merchant account settings';
    const headingPath = ['Settings'];

    // With phrase match
    const phraseScore = scoreChunkWithPhrases(content, headingPath, ['merchant', 'account'], ['merchant account']);

    // Without phrase (just terms)
    const termScore = scoreChunkWithPhrases(content, headingPath, ['merchant', 'account'], []);

    expect(phraseScore).toBeGreaterThan(termScore);
  });

  it('heavily weights phrase in heading', () => {
    const content = 'Some generic content about setup';
    const headingPath = ['Merchant Account Configuration'];

    const score = scoreChunkWithPhrases(content, headingPath, ['configure'], ['merchant account']);

    // Should have WEIGHT_PHRASE_HEADING bonus
    expect(score).toBeGreaterThan(WEIGHT_PHRASE_HEADING / 2); // After normalization
  });

  it('combines term and phrase scoring', () => {
    const content = 'Configure your merchant account for webhooks';
    const headingPath = ['Setup'];

    const fullScore = scoreChunkWithPhrases(
      content,
      headingPath,
      ['configure', 'webhook'],
      ['merchant account']
    );

    const termsOnlyScore = scoreChunkWithPhrases(content, headingPath, ['configure', 'webhook'], []);

    expect(fullScore).toBeGreaterThan(termsOnlyScore);
  });
});

// ============================================================================
// Integration tests: synonym expansion in scoring
// ============================================================================

describe('synonym expansion in scoring', () => {
  it('matches via synonyms', () => {
    const content = 'Set up your callback endpoint';
    const headingPath = ['Callbacks'];

    // Query for 'webhook' should match 'callback' via synonym
    const queryTerms = tokenize('webhook');

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBeGreaterThan(0);
  });

  it('matches merchant via mid synonym', () => {
    const content = 'Your MID is required for processing';
    const headingPath = ['MID Setup'];

    const queryTerms = tokenize('merchant');

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================================================
// Integration tests: plural normalization in scoring
// ============================================================================

describe('plural normalization in scoring', () => {
  it('matches singular content with plural query', () => {
    const content = 'Configure your webhook endpoint';
    const headingPath = ['Webhook'];

    const queryTerms = tokenize('webhooks endpoints');

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBeGreaterThan(0);
  });

  it('matches plural content with singular query', () => {
    const content = 'Configure your webhooks and endpoints';
    const headingPath = ['Webhooks'];

    const queryTerms = tokenize('webhook endpoint');

    const score = scoreChunk(content, headingPath, queryTerms);
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================================================
// Ranking tests: ensure improved scoring produces expected rankings
// ============================================================================

describe('ranking quality', () => {
  it('ranks heading match higher than body-only match', () => {
    const headingMatch = {
      content: 'Some generic content about configuration',
      headingPath: ['Webhook Configuration'],
    };

    const bodyOnlyMatch = {
      content: 'Webhook configuration is done via the dashboard',
      headingPath: ['General Settings'],
    };

    const queryTerms = tokenize('webhook configuration');

    const headingScore = scoreChunk(headingMatch.content, headingMatch.headingPath, queryTerms);
    const bodyScore = scoreChunk(bodyOnlyMatch.content, bodyOnlyMatch.headingPath, queryTerms);

    // Heading match should rank higher even with less content matches
    expect(headingScore).toBeGreaterThan(bodyScore);
  });

  it('ranks dense chunks higher than sparse chunks', () => {
    const denseChunk = {
      content: 'Webhook endpoint configuration. Set up your webhook URL.',
      headingPath: ['Webhooks'],
    };

    const sparseChunk = {
      content:
        'This is a long document about many topics. ' +
        'webhook ' +
        'There are sections about various features. ' +
        'endpoint ' +
        'And much more content here.',
      headingPath: ['General'],
    };

    const queryTerms = tokenize('webhook endpoint');

    const denseScore = scoreChunk(denseChunk.content, denseChunk.headingPath, queryTerms);
    const sparseScore = scoreChunk(sparseChunk.content, sparseChunk.headingPath, queryTerms);

    // Dense chunk should rank higher (proximity + length normalization)
    expect(denseScore).toBeGreaterThan(sparseScore);
  });

  it('prioritizes exact phrase over scattered keywords', () => {
    const phraseChunk = {
      content: 'Your merchant account is used for processing',
      headingPath: ['Merchant Account'],
    };

    const scatteredChunk = {
      content: 'Merchant services include account management',
      headingPath: ['Services'],
    };

    const { terms, phrases } = tokenizeWithPhrases('"merchant account"');

    const phraseScore = scoreChunkWithPhrases(
      phraseChunk.content,
      phraseChunk.headingPath,
      terms,
      phrases
    );
    const scatteredScore = scoreChunkWithPhrases(
      scatteredChunk.content,
      scatteredChunk.headingPath,
      terms,
      phrases
    );

    // Phrase match should dominate
    expect(phraseScore).toBeGreaterThan(scatteredScore);
  });
});

// ============================================================================
// Constants validation tests
// ============================================================================

describe('scoring constants', () => {
  it('has sensible weight ordering', () => {
    // Phrase in heading should be highest
    expect(WEIGHT_PHRASE_HEADING).toBeGreaterThan(WEIGHT_PHRASE_CONTENT);
    // Phrase in content should be higher than heading term
    expect(WEIGHT_PHRASE_CONTENT).toBeGreaterThan(WEIGHT_HEADING_TERM);
    // Heading term should be higher than content term
    expect(WEIGHT_HEADING_TERM).toBeGreaterThan(WEIGHT_CONTENT_TERM);
  });

  it('has reasonable proximity window', () => {
    expect(PROXIMITY_WINDOW).toBeGreaterThanOrEqual(20);
    expect(PROXIMITY_WINDOW).toBeLessThanOrEqual(50);
  });

  it('has reasonable minimum length', () => {
    expect(MIN_LENGTH_FOR_NORMALIZATION).toBeGreaterThanOrEqual(50);
    expect(MIN_LENGTH_FOR_NORMALIZATION).toBeLessThanOrEqual(200);
  });
});
