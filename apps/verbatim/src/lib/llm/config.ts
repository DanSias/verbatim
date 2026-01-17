/**
 * LLM Configuration with Defensive Caps
 *
 * Server-side caps to prevent abuse and control costs.
 * These caps don't affect retrieval ranking, only LLM usage.
 *
 * Environment variables:
 * - LLM_MAX_TOKENS: Max output tokens (default: 700)
 * - LLM_TEMPERATURE: Default temperature (default: 0.2)
 * - LLM_MAX_CHUNKS: Max chunks to send to LLM (default: 6)
 * - LLM_MAX_EXCERPT_CHARS: Max chars per chunk excerpt (default: 1200)
 */

/** Default values for LLM caps */
const DEFAULTS = {
  maxTokens: 700,
  temperature: 0.2,
  maxChunks: 6,
  maxExcerptChars: 1200,
};

/** LLM defensive caps configuration */
export interface LLMCaps {
  /** Maximum output tokens */
  maxTokens: number;
  /** Default temperature */
  temperature: number;
  /** Maximum chunks to include in prompt */
  maxChunks: number;
  /** Maximum characters per chunk excerpt */
  maxExcerptChars: number;
}

/**
 * Get LLM caps from environment variables.
 */
export function getLLMCaps(): LLMCaps {
  return {
    maxTokens: parseEnvInt('LLM_MAX_TOKENS', DEFAULTS.maxTokens),
    temperature: parseEnvFloat('LLM_TEMPERATURE', DEFAULTS.temperature),
    maxChunks: parseEnvInt('LLM_MAX_CHUNKS', DEFAULTS.maxChunks),
    maxExcerptChars: parseEnvInt('LLM_MAX_EXCERPT_CHARS', DEFAULTS.maxExcerptChars),
  };
}

/**
 * Truncate chunk content to the maximum excerpt length.
 *
 * @param content - Chunk content
 * @param maxChars - Maximum characters (from caps)
 */
export function truncateExcerpt(content: string, maxChars?: number): string {
  const max = maxChars ?? getLLMCaps().maxExcerptChars;
  if (content.length <= max) {
    return content;
  }
  return content.slice(0, max) + '...';
}

/**
 * Limit chunks to the maximum allowed for LLM prompts.
 *
 * @param chunks - Array of chunks
 * @param maxChunks - Maximum chunks (from caps)
 */
export function limitChunks<T>(chunks: T[], maxChunks?: number): T[] {
  const max = maxChunks ?? getLLMCaps().maxChunks;
  return chunks.slice(0, max);
}

/** Parse an integer from environment variable */
function parseEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
}

/** Parse a float from environment variable */
function parseEnvFloat(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultValue;
}
