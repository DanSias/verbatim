/**
 * In-Memory Rate Limiting
 *
 * Simple fixed-window rate limiting for pilot use.
 * Keys by IP address and optionally workspaceId.
 *
 * TODO: Replace with Redis/Upstash for production multi-instance deployments.
 *
 * Environment variables:
 * - RATE_LIMIT_WINDOW_MS: Window duration in ms (default: 60000)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 60)
 */

import { NextRequest } from 'next/server';

/** Rate limit configuration */
export interface RateLimitConfig {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
}

/** Result of a rate limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in this window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in this window */
  remaining: number;
  /** Unix timestamp when the window resets */
  resetTimestamp: number;
  /** Seconds until the window resets */
  retryAfterSeconds: number;
}

/** In-memory store entry */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/** In-memory store keyed by rate limit key */
const store = new Map<string, RateLimitEntry>();

/** Cleanup interval handle */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get rate limit configuration from environment variables.
 */
export function getRateLimitConfig(): RateLimitConfig {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10);

  return {
    windowMs: isNaN(windowMs) ? 60000 : windowMs,
    maxRequests: isNaN(maxRequests) ? 60 : maxRequests,
  };
}

/**
 * Extract client IP from a NextRequest.
 * Handles common proxy headers (Cloudflare, nginx, etc.).
 */
export function getClientIp(request: NextRequest): string {
  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // X-Forwarded-For (may contain multiple IPs; use first)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // X-Real-IP (nginx)
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  // Fallback to unknown (should not happen in production)
  return 'unknown';
}

/**
 * Build a rate limit key from IP and optional workspaceId.
 *
 * @param ip - Client IP address
 * @param workspaceId - Optional workspace ID for per-workspace limits
 */
export function buildRateLimitKey(ip: string, workspaceId?: string): string {
  if (workspaceId) {
    return `${ip}:${workspaceId}`;
  }
  return ip;
}

/**
 * Check rate limit for a given key.
 *
 * @param key - Rate limit key (usually IP or IP:workspaceId)
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export function checkRateLimit(key: string, config?: RateLimitConfig): RateLimitResult {
  const { windowMs, maxRequests } = config ?? getRateLimitConfig();
  const now = Date.now();

  let entry = store.get(key);

  // Check if current window has expired
  if (!entry || now - entry.windowStart >= windowMs) {
    // Start a new window
    entry = { count: 1, windowStart: now };
    store.set(key, entry);

    return {
      allowed: true,
      current: 1,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTimestamp: Math.floor((now + windowMs) / 1000),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  // Increment count in current window
  entry.count += 1;
  store.set(key, entry);

  const remaining = Math.max(0, maxRequests - entry.count);
  const msUntilReset = windowMs - (now - entry.windowStart);
  const resetTimestamp = Math.floor((entry.windowStart + windowMs) / 1000);
  const retryAfterSeconds = Math.ceil(msUntilReset / 1000);

  return {
    allowed: entry.count <= maxRequests,
    current: entry.count,
    limit: maxRequests,
    remaining,
    resetTimestamp,
    retryAfterSeconds,
  };
}

/**
 * Apply rate limiting to a request.
 * Extracts IP and optional workspaceId, then checks limits.
 *
 * @param request - NextRequest object
 * @param workspaceId - Optional workspace ID for per-workspace limits
 * @param config - Optional rate limit configuration
 */
export function applyRateLimit(
  request: NextRequest,
  workspaceId?: string,
  config?: RateLimitConfig
): RateLimitResult {
  const ip = getClientIp(request);
  const key = buildRateLimitKey(ip, workspaceId);
  return checkRateLimit(key, config);
}

/**
 * Clear all rate limit entries.
 * Useful for testing.
 */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Get the current size of the rate limit store.
 * Useful for debugging.
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}

/**
 * Start periodic cleanup of expired entries.
 * Call this once on server start.
 *
 * @param intervalMs - Cleanup interval (default: 5 minutes)
 */
export function startRateLimitCleanup(intervalMs = 300000): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const config = getRateLimitConfig();
    const now = Date.now();

    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart >= config.windowMs) {
        store.delete(key);
      }
    }
  }, intervalMs);
}

/**
 * Stop periodic cleanup.
 * Useful for testing.
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
