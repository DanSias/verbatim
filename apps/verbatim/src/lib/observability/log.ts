/**
 * Structured Logging Utilities
 *
 * Provides consistent, structured JSON logging for API operations.
 * Avoids logging full user content; logs truncated previews and lengths.
 *
 * All logs include:
 * - timestamp (ISO 8601)
 * - level (info, warn, error)
 * - event name
 * - payload (structured data)
 */

/** Log levels */
export type LogLevel = 'info' | 'warn' | 'error';

/** Base log entry structure */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Truncate text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 80)
 */
export function truncateText(text: string, maxLength = 80): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Create a log entry with common fields.
 */
function createLogEntry(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };
}

/**
 * Log an info-level message.
 *
 * @param event - Event name (e.g., 'answer.request.start')
 * @param payload - Structured data to log
 */
export function logInfo(event: string, payload: Record<string, unknown> = {}): void {
  const entry = createLogEntry('info', event, payload);
  console.log(JSON.stringify(entry));
}

/**
 * Log a warn-level message.
 *
 * @param event - Event name (e.g., 'answer.confidence.low')
 * @param payload - Structured data to log
 */
export function logWarn(event: string, payload: Record<string, unknown> = {}): void {
  const entry = createLogEntry('warn', event, payload);
  console.warn(JSON.stringify(entry));
}

/**
 * Log an error-level message.
 *
 * @param event - Event name (e.g., 'answer.error')
 * @param payload - Structured data to log
 */
export function logError(event: string, payload: Record<string, unknown> = {}): void {
  const entry = createLogEntry('error', event, payload);
  console.error(JSON.stringify(entry));
}

/** Common payload fields for API request logging */
export interface RequestLogPayload {
  requestId: string;
  workspaceId: string;
  questionLength: number;
  questionPreview?: string;
  corpusScope?: string[];
  topK?: number;
}

/** Common payload fields for API response logging */
export interface ResponseLogPayload {
  requestId: string;
  workspaceId: string;
  latencyMs: number;
  retrievalLatencyMs?: number;
  llmLatencyMs?: number;
  provider?: string;
  model?: string;
  mode?: string;
  confidence?: string;
  chunksUsed?: number;
  topCitations?: Array<{ route?: string; sourcePath?: string }>;
  error?: string;
  errorCode?: string;
  timeout?: boolean;
}

/**
 * Log the start of an API request.
 *
 * @param endpoint - Endpoint name (e.g., 'answer', 'ask')
 * @param payload - Request payload
 */
export function logRequestStart(endpoint: string, payload: RequestLogPayload): void {
  logInfo(`${endpoint}.request.start`, {
    ...payload,
  });
}

/**
 * Log the completion of an API request.
 *
 * @param endpoint - Endpoint name (e.g., 'answer', 'ask')
 * @param payload - Response payload
 */
export function logRequestEnd(endpoint: string, payload: ResponseLogPayload): void {
  const level = payload.error ? 'error' : 'info';
  const logFn = level === 'error' ? logError : logInfo;
  logFn(`${endpoint}.request.end`, { ...payload });
}

/**
 * Log a rate limit event.
 *
 * @param endpoint - Endpoint name
 * @param payload - Rate limit details
 */
export function logRateLimit(
  endpoint: string,
  payload: {
    requestId: string;
    ip: string;
    workspaceId?: string;
    current: number;
    limit: number;
  }
): void {
  logWarn(`${endpoint}.rate_limited`, payload);
}

/**
 * Format top citations for logging.
 * Limits to top N citations and extracts route/sourcePath only.
 *
 * @param citations - Array of citations
 * @param limit - Maximum citations to include (default: 3)
 */
export function formatTopCitations(
  citations: Array<{ corpus: string; route?: string; sourcePath?: string }>,
  limit = 3
): Array<{ route?: string; sourcePath?: string }> {
  return citations.slice(0, limit).map((c) => ({
    ...(c.route && { route: c.route }),
    ...(c.sourcePath && { sourcePath: c.sourcePath }),
  }));
}
