/**
 * Unit tests for confidence scoring.
 *
 * Tests deterministic confidence computation without database.
 */

import { describe, it, expect } from 'vitest';
import {
  computeConfidence,
  meetsConfidenceThreshold,
  type ConfidenceLevel,
} from '../confidence';
import type { SearchResult, SuggestedRoute } from '@/lib/retrieval';

/** Helper to create a mock search result */
function mockResult(
  corpus: 'docs' | 'kb',
  score: number,
  overrides?: Partial<SearchResult>
): SearchResult {
  const base: SearchResult = {
    corpus,
    documentId: 'doc-1',
    canonicalId: corpus === 'docs' ? 'docs:/test' : 'kb:test.md',
    chunkId: 'chunk-1',
    headingPath: ['Test'],
    score,
    citation:
      corpus === 'docs'
        ? { route: '/test', anchor: null, url: '/test' }
        : { sourcePath: 'test.md' },
    excerpt: 'Test content',
  };
  return { ...base, ...overrides };
}

/** Helper to create mock suggested routes */
function mockRoutes(count: number): SuggestedRoute[] {
  return Array.from({ length: count }, (_, i) => ({
    route: `/route-${i}`,
    title: `Route ${i}`,
  }));
}

describe('computeConfidence', () => {
  describe('low confidence', () => {
    it('returns low when no results', () => {
      const result = computeConfidence([], []);
      expect(result.confidence).toBe('low');
      expect(result.signals.resultCount).toBe(0);
    });

    it('returns low when top score is very low', () => {
      const results = [mockResult('docs', 0.1), mockResult('kb', 0.05)];
      const result = computeConfidence(results, mockRoutes(1));
      expect(result.confidence).toBe('low');
    });

    it('returns low for single KB result with low score', () => {
      const results = [mockResult('kb', 0.2)];
      const result = computeConfidence(results, []);
      expect(result.confidence).toBe('low');
    });
  });

  describe('medium confidence', () => {
    it('returns medium when docs in top with one docs result', () => {
      const results = [mockResult('docs', 1.5), mockResult('kb', 0.8)];
      const result = computeConfidence(results, mockRoutes(1));
      expect(result.confidence).toBe('medium');
    });

    it('returns medium for KB-only with decent score', () => {
      const results = [mockResult('kb', 1.0), mockResult('kb', 0.5)];
      const result = computeConfidence(results, []);
      expect(result.confidence).toBe('medium');
    });

    it('returns medium when score is good but not enough docs', () => {
      const results = [mockResult('docs', 1.8), mockResult('kb', 1.5)];
      const result = computeConfidence(results, mockRoutes(1));
      expect(result.confidence).toBe('medium');
    });
  });

  describe('high confidence', () => {
    it('returns high when docs in top with multiple docs and good scores', () => {
      const results = [
        mockResult('docs', 3.0),
        mockResult('docs', 1.5),
        mockResult('kb', 0.5),
      ];
      const result = computeConfidence(results, mockRoutes(2));
      expect(result.confidence).toBe('high');
    });

    it('returns high with high average score and multiple docs', () => {
      const results = [
        mockResult('docs', 2.5),
        mockResult('docs', 2.3),
        mockResult('docs', 2.0),
      ];
      const result = computeConfidence(results, mockRoutes(3));
      expect(result.confidence).toBe('high');
    });
  });

  describe('signals', () => {
    it('correctly computes all signals', () => {
      const results = [
        mockResult('docs', 2.5),
        mockResult('kb', 1.5),
        mockResult('docs', 1.0),
      ];
      const routes = mockRoutes(2);

      const { signals } = computeConfidence(results, routes);

      expect(signals.topScore).toBe(2.5);
      expect(signals.secondScore).toBe(1.5);
      expect(signals.scoreGap).toBe(1.0);
      expect(signals.docsCount).toBe(2);
      expect(signals.kbCount).toBe(1);
      expect(signals.hasDocsTop1).toBe(true);
      expect(signals.resultCount).toBe(3);
      expect(signals.suggestedRoutesCount).toBe(2);
      expect(signals.avgTop3Score).toBeCloseTo((2.5 + 1.5 + 1.0) / 3);
    });

    it('handles empty results for signals', () => {
      const { signals } = computeConfidence([], []);

      expect(signals.topScore).toBe(0);
      expect(signals.secondScore).toBe(0);
      expect(signals.scoreGap).toBe(0);
      expect(signals.docsCount).toBe(0);
      expect(signals.kbCount).toBe(0);
      expect(signals.hasDocsTop1).toBe(false);
      expect(signals.avgTop3Score).toBe(0);
    });

    it('handles single result for signals', () => {
      const results = [mockResult('kb', 1.5)];
      const { signals } = computeConfidence(results, []);

      expect(signals.topScore).toBe(1.5);
      expect(signals.secondScore).toBe(0);
      expect(signals.scoreGap).toBe(1.5);
      expect(signals.hasDocsTop1).toBe(false);
      expect(signals.avgTop3Score).toBe(1.5);
    });
  });
});

describe('meetsConfidenceThreshold', () => {
  it('returns true when actual equals minimum', () => {
    expect(meetsConfidenceThreshold('high', 'high')).toBe(true);
    expect(meetsConfidenceThreshold('medium', 'medium')).toBe(true);
    expect(meetsConfidenceThreshold('low', 'low')).toBe(true);
  });

  it('returns true when actual exceeds minimum', () => {
    expect(meetsConfidenceThreshold('high', 'medium')).toBe(true);
    expect(meetsConfidenceThreshold('high', 'low')).toBe(true);
    expect(meetsConfidenceThreshold('medium', 'low')).toBe(true);
  });

  it('returns false when actual is below minimum', () => {
    expect(meetsConfidenceThreshold('low', 'medium')).toBe(false);
    expect(meetsConfidenceThreshold('low', 'high')).toBe(false);
    expect(meetsConfidenceThreshold('medium', 'high')).toBe(false);
  });
});
