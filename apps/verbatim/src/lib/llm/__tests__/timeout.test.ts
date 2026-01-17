/**
 * Unit tests for LLM timeout utilities.
 *
 * Tests timeout behavior without making real API calls.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  withTimeout,
  LLMTimeoutError,
  LLMAbortError,
  getLLMTimeout,
  createTimeoutController,
} from '../timeout';

describe('getLLMTimeout', () => {
  const originalEnv = process.env.LLM_TIMEOUT_MS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.LLM_TIMEOUT_MS = originalEnv;
    } else {
      delete process.env.LLM_TIMEOUT_MS;
    }
  });

  it('returns default timeout when env not set', () => {
    delete process.env.LLM_TIMEOUT_MS;
    expect(getLLMTimeout()).toBe(20000);
  });

  it('returns env value when set', () => {
    process.env.LLM_TIMEOUT_MS = '5000';
    expect(getLLMTimeout()).toBe(5000);
  });

  it('returns default for invalid env value', () => {
    process.env.LLM_TIMEOUT_MS = 'invalid';
    expect(getLLMTimeout()).toBe(20000);
  });

  it('returns default for negative env value', () => {
    process.env.LLM_TIMEOUT_MS = '-1000';
    expect(getLLMTimeout()).toBe(20000);
  });
});

describe('withTimeout', () => {
  it('resolves when function completes before timeout', async () => {
    const result = await withTimeout(1000, async () => 'success');
    expect(result).toBe('success');
  });

  it('passes AbortSignal to function', async () => {
    let receivedSignal: AbortSignal | undefined;
    await withTimeout(1000, async (signal) => {
      receivedSignal = signal;
      return 'done';
    });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it('throws LLMTimeoutError when timeout exceeded', async () => {
    // Use a very short timeout to trigger quickly
    const promise = withTimeout(10, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'too late';
    });

    await expect(promise).rejects.toThrow(LLMTimeoutError);
  });

  it('LLMTimeoutError includes timeout duration', async () => {
    try {
      await withTimeout(15, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LLMTimeoutError);
      expect((error as LLMTimeoutError).timeoutMs).toBe(15);
    }
  });

  it('propagates errors from the function', async () => {
    const promise = withTimeout(1000, async () => {
      throw new Error('API error: rate limited');
    });

    await expect(promise).rejects.toThrow('API error: rate limited');
  });

  it('signal is aborted on timeout', async () => {
    let signalAborted = false;

    try {
      await withTimeout(10, async (signal) => {
        signal.addEventListener('abort', () => {
          signalAborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    } catch {
      // Expected timeout
    }

    expect(signalAborted).toBe(true);
  });
});

describe('createTimeoutController', () => {
  it('returns controller, signal, and cleanup function', () => {
    const result = createTimeoutController(1000);

    expect(result.controller).toBeInstanceOf(AbortController);
    expect(result.signal).toBeInstanceOf(AbortSignal);
    expect(typeof result.cleanup).toBe('function');

    result.cleanup();
  });

  it('signal is not aborted initially', () => {
    const { signal, cleanup } = createTimeoutController(1000);
    expect(signal.aborted).toBe(false);
    cleanup();
  });

  it('signal is aborted after timeout', async () => {
    const { signal, cleanup } = createTimeoutController(10);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('cleanup prevents abort', async () => {
    const { signal, cleanup } = createTimeoutController(50);

    cleanup(); // Cancel immediately
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(signal.aborted).toBe(false);
  });
});

describe('LLMTimeoutError', () => {
  it('has correct name', () => {
    const error = new LLMTimeoutError(5000);
    expect(error.name).toBe('LLMTimeoutError');
  });

  it('has correct message', () => {
    const error = new LLMTimeoutError(5000);
    expect(error.message).toBe('LLM request timed out after 5000ms');
  });

  it('stores timeout value', () => {
    const error = new LLMTimeoutError(3000);
    expect(error.timeoutMs).toBe(3000);
  });
});

describe('LLMAbortError', () => {
  it('has correct name', () => {
    const error = new LLMAbortError();
    expect(error.name).toBe('LLMAbortError');
  });

  it('has default message', () => {
    const error = new LLMAbortError();
    expect(error.message).toBe('LLM request was aborted');
  });

  it('accepts custom message', () => {
    const error = new LLMAbortError('Custom abort reason');
    expect(error.message).toBe('Custom abort reason');
  });
});
