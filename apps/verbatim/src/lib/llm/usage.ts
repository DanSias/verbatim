/**
 * LLM Usage Extraction
 *
 * Provides utilities for extracting token usage from provider responses.
 * Handles the different response formats from Gemini, OpenAI, and Anthropic.
 */

import type { LLMProviderName, LLMGenerateResult } from './types';

/** Extracted usage information */
export interface ExtractedUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

/**
 * Extract usage from an LLM generate result.
 * Uses the structured usage field if available, falls back to raw response parsing.
 *
 * @param result The LLM generate result
 * @param provider The provider name (for fallback parsing)
 * @returns Extracted usage or null if not available
 */
export function extractUsage(
  result: LLMGenerateResult,
  provider: LLMProviderName
): ExtractedUsage | null {
  // Try structured usage field first (already normalized by providers)
  if (result.usage) {
    const input = result.usage.inputTokens ?? null;
    const output = result.usage.outputTokens ?? null;
    const total = input !== null && output !== null ? input + output : null;

    if (input !== null || output !== null) {
      return { inputTokens: input, outputTokens: output, totalTokens: total };
    }
  }

  // Fall back to raw response parsing
  if (result.raw) {
    return extractUsageFromRaw(result.raw, provider);
  }

  return null;
}

/**
 * Extract usage from raw provider response.
 * Handles provider-specific response formats.
 */
export function extractUsageFromRaw(
  raw: unknown,
  provider: LLMProviderName
): ExtractedUsage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  switch (provider) {
    case 'gemini':
      return extractGeminiUsage(raw);
    case 'openai':
      return extractOpenAIUsage(raw);
    case 'anthropic':
      return extractAnthropicUsage(raw);
    default:
      return null;
  }
}

/**
 * Extract usage from Gemini raw response.
 * Gemini uses usageMetadata with promptTokenCount and candidatesTokenCount.
 */
function extractGeminiUsage(raw: object): ExtractedUsage | null {
  const r = raw as Record<string, unknown>;
  const usageMetadata = r.usageMetadata as Record<string, unknown> | undefined;

  if (!usageMetadata) {
    return null;
  }

  const input = typeof usageMetadata.promptTokenCount === 'number'
    ? usageMetadata.promptTokenCount
    : null;
  const output = typeof usageMetadata.candidatesTokenCount === 'number'
    ? usageMetadata.candidatesTokenCount
    : null;
  const total = input !== null && output !== null ? input + output : null;

  if (input === null && output === null) {
    return null;
  }

  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

/**
 * Extract usage from OpenAI raw response.
 * OpenAI uses usage with prompt_tokens and completion_tokens.
 */
function extractOpenAIUsage(raw: object): ExtractedUsage | null {
  const r = raw as Record<string, unknown>;
  const usage = r.usage as Record<string, unknown> | undefined;

  if (!usage) {
    return null;
  }

  const input = typeof usage.prompt_tokens === 'number'
    ? usage.prompt_tokens
    : null;
  const output = typeof usage.completion_tokens === 'number'
    ? usage.completion_tokens
    : null;
  const total = typeof usage.total_tokens === 'number'
    ? usage.total_tokens
    : (input !== null && output !== null ? input + output : null);

  if (input === null && output === null) {
    return null;
  }

  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

/**
 * Extract usage from Anthropic raw response.
 * Anthropic uses usage with input_tokens and output_tokens.
 */
function extractAnthropicUsage(raw: object): ExtractedUsage | null {
  const r = raw as Record<string, unknown>;
  const usage = r.usage as Record<string, unknown> | undefined;

  if (!usage) {
    return null;
  }

  const input = typeof usage.input_tokens === 'number'
    ? usage.input_tokens
    : null;
  const output = typeof usage.output_tokens === 'number'
    ? usage.output_tokens
    : null;
  const total = input !== null && output !== null ? input + output : null;

  if (input === null && output === null) {
    return null;
  }

  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

/**
 * Extract usage from an upstream response JSON (for widget proxy in remote mode).
 * The upstream might return usage in debug.usage or similar structure.
 */
export function extractUsageFromUpstreamResponse(
  response: unknown
): ExtractedUsage | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const r = response as Record<string, unknown>;

  // Check debug.inputTokens/outputTokens pattern
  const debug = r.debug as Record<string, unknown> | undefined;
  if (debug) {
    const input = typeof debug.inputTokens === 'number' ? debug.inputTokens : null;
    const output = typeof debug.outputTokens === 'number' ? debug.outputTokens : null;
    const total = typeof debug.totalTokens === 'number'
      ? debug.totalTokens
      : (input !== null && output !== null ? input + output : null);

    if (input !== null || output !== null) {
      return { inputTokens: input, outputTokens: output, totalTokens: total };
    }
  }

  // Check for top-level usage object
  const usage = r.usage as Record<string, unknown> | undefined;
  if (usage) {
    const input = typeof usage.inputTokens === 'number'
      ? usage.inputTokens
      : (typeof usage.input_tokens === 'number' ? usage.input_tokens : null);
    const output = typeof usage.outputTokens === 'number'
      ? usage.outputTokens
      : (typeof usage.output_tokens === 'number' ? usage.output_tokens : null);
    const total = input !== null && output !== null ? input + output : null;

    if (input !== null || output !== null) {
      return { inputTokens: input, outputTokens: output, totalTokens: total };
    }
  }

  return null;
}
