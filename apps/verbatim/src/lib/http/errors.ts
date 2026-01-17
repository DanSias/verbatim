/**
 * HTTP Error Utilities
 *
 * Standardized JSON error responses for API endpoints.
 * All errors return a consistent shape: { error, code, details? }
 */

import { NextResponse } from 'next/server';

/** Standard error codes used across all API endpoints */
export type ErrorCode =
  | 'INVALID_JSON'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'LLM_TIMEOUT'
  | 'LLM_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/** Standard API error response shape */
export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
}

/**
 * Create a JSON error response.
 *
 * @param code - Error code (e.g., 'VALIDATION_ERROR')
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional additional details
 * @returns NextResponse with JSON error body
 */
export function jsonError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error: message, code };
  if (details) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

/**
 * Create a 400 Bad Request error for invalid JSON parsing.
 */
export function invalidJsonError(details?: Record<string, unknown>): NextResponse<ApiErrorResponse> {
  return jsonError('INVALID_JSON', 'Invalid JSON in request body', 400, details);
}

/**
 * Create a 400 Bad Request error for validation failures.
 */
export function validationError(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return jsonError('VALIDATION_ERROR', message, 400, details);
}

/**
 * Create a 429 Too Many Requests error for rate limiting.
 *
 * @param retryAfterSeconds - Seconds until the client can retry
 * @param limit - The rate limit that was exceeded
 * @param remaining - Remaining requests (usually 0)
 * @param resetTimestamp - Unix timestamp when the limit resets
 */
export function rateLimitError(
  retryAfterSeconds: number,
  limit: number,
  remaining: number,
  resetTimestamp: number
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: 'Rate limit exceeded. Please try again later.',
    code: 'RATE_LIMITED',
    details: {
      retryAfterSeconds,
      limit,
      remaining,
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(resetTimestamp),
    },
  });
}

/**
 * Create a 504 Gateway Timeout error for LLM timeouts.
 */
export function llmTimeoutError(
  timeoutMs: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return jsonError(
    'LLM_TIMEOUT',
    `LLM request timed out after ${timeoutMs}ms`,
    504,
    details
  );
}

/**
 * Create a 502 Bad Gateway error for LLM failures.
 */
export function llmError(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return jsonError('LLM_ERROR', message, 502, details);
}

/**
 * Create a 404 Not Found error.
 */
export function notFoundError(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return jsonError('NOT_FOUND', message, 404, details);
}

/**
 * Create a 500 Internal Server Error.
 */
export function internalError(
  message = 'Internal server error',
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return jsonError('INTERNAL_ERROR', message, 500, details);
}
