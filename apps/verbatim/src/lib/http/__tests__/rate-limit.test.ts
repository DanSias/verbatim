/**
 * Unit tests for rate limiting utilities.
 *
 * Tests in-memory rate limiter behavior without external dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  buildRateLimitKey,
  getClientIp,
  clearRateLimitStore,
  getRateLimitStoreSize,
  type RateLimitConfig,
} from '../rate-limit';

// Mock NextRequest for getClientIp tests
function mockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as import('next/server').NextRequest;
}

describe('buildRateLimitKey', () => {
  it('builds key from IP only', () => {
    expect(buildRateLimitKey('192.168.1.1')).toBe('192.168.1.1');
  });

  it('builds key from IP and workspaceId', () => {
    expect(buildRateLimitKey('192.168.1.1', 'ws_123')).toBe('192.168.1.1:ws_123');
  });
});

describe('getClientIp', () => {
  it('extracts IP from cf-connecting-ip header', () => {
    const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts first IP from x-forwarded-for header', () => {
    const req = mockRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts IP from x-real-ip header', () => {
    const req = mockRequest({ 'x-real-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const req = mockRequest({
      'cf-connecting-ip': '1.1.1.1',
      'x-forwarded-for': '2.2.2.2',
    });
    expect(getClientIp(req)).toBe('1.1.1.1');
  });

  it('returns unknown when no headers present', () => {
    const req = mockRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  const config: RateLimitConfig = {
    windowMs: 1000, // 1 second window
    maxRequests: 3,
  };

  beforeEach(() => {
    clearRateLimitStore();
  });

  afterEach(() => {
    clearRateLimitStore();
  });

  it('allows first request', () => {
    const result = checkRateLimit('test-key', config);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.remaining).toBe(2);
    expect(result.limit).toBe(3);
  });

  it('allows requests up to limit', () => {
    checkRateLimit('test-key', config);
    checkRateLimit('test-key', config);
    const result = checkRateLimit('test-key', config);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
    expect(result.remaining).toBe(0);
  });

  it('blocks requests exceeding limit', () => {
    checkRateLimit('test-key', config);
    checkRateLimit('test-key', config);
    checkRateLimit('test-key', config);
    const result = checkRateLimit('test-key', config);

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(4);
    expect(result.remaining).toBe(0);
  });

  it('provides correct retryAfterSeconds', () => {
    const result = checkRateLimit('test-key', config);
    expect(result.retryAfterSeconds).toBe(1); // 1000ms = 1 second
  });

  it('provides valid resetTimestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = checkRateLimit('test-key', config);
    const after = Math.floor(Date.now() / 1000) + 1;

    expect(result.resetTimestamp).toBeGreaterThanOrEqual(before);
    expect(result.resetTimestamp).toBeLessThanOrEqual(after + 1);
  });

  it('resets after window expires', async () => {
    // Use fake timers
    vi.useFakeTimers();

    checkRateLimit('test-key', config);
    checkRateLimit('test-key', config);
    checkRateLimit('test-key', config);
    const blocked = checkRateLimit('test-key', config);
    expect(blocked.allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1100);

    const afterReset = checkRateLimit('test-key', config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.current).toBe(1);
    expect(afterReset.remaining).toBe(2);

    vi.useRealTimers();
  });

  it('tracks different keys independently', () => {
    checkRateLimit('key-a', config);
    checkRateLimit('key-a', config);
    checkRateLimit('key-a', config);

    const resultA = checkRateLimit('key-a', config);
    const resultB = checkRateLimit('key-b', config);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
    expect(resultB.current).toBe(1);
  });

  it('tracks store size correctly', () => {
    expect(getRateLimitStoreSize()).toBe(0);

    checkRateLimit('key-1', config);
    expect(getRateLimitStoreSize()).toBe(1);

    checkRateLimit('key-2', config);
    expect(getRateLimitStoreSize()).toBe(2);

    clearRateLimitStore();
    expect(getRateLimitStoreSize()).toBe(0);
  });
});
