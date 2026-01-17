/**
 * LLM Timeout Utilities
 *
 * Provides timeout handling for LLM calls using AbortController.
 *
 * Behavior on timeout:
 * - Throws a LLMTimeoutError which the caller can catch
 * - Caller can choose to return a fallback response or error
 *
 * Environment variables:
 * - LLM_TIMEOUT_MS: Timeout duration in ms (default: 20000)
 */

/** Default timeout for LLM calls (20 seconds) */
const DEFAULT_TIMEOUT_MS = 20000;

/** Error thrown when an LLM call times out */
export class LLMTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Error thrown when an LLM call is aborted */
export class LLMAbortError extends Error {
  constructor(message = 'LLM request was aborted') {
    super(message);
    this.name = 'LLMAbortError';
  }
}

/**
 * Get the LLM timeout from environment variables.
 */
export function getLLMTimeout(): number {
  const envTimeout = process.env.LLM_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Execute a function with a timeout.
 * Throws LLMTimeoutError if the timeout is exceeded.
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @param fn - Async function to execute (receives AbortSignal)
 * @returns Result of the function
 * @throws LLMTimeoutError if timeout exceeded
 * @throws LLMAbortError if aborted for other reasons
 */
export async function withTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const { signal } = controller;

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new LLMTimeoutError(timeoutMs));
    }, timeoutMs);

    // Clean up timer if the signal is already aborted
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });

  try {
    // Race between the function and the timeout
    return await Promise.race([fn(signal), timeoutPromise]);
  } catch (error) {
    // Re-throw LLMTimeoutError as-is
    if (error instanceof LLMTimeoutError) {
      throw error;
    }

    // Convert AbortError to LLMAbortError
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMAbortError();
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Execute a function with the default LLM timeout.
 *
 * @param fn - Async function to execute (receives AbortSignal)
 * @returns Result of the function
 */
export async function withLLMTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  return withTimeout(getLLMTimeout(), fn);
}

/**
 * Create an AbortController with a timeout.
 * Useful for manual abort control with timeout fallback.
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @returns Object with controller and cleanup function
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timer);
  };

  return {
    controller,
    signal: controller.signal,
    cleanup,
  };
}
