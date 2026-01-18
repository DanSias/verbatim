/**
 * Model Pricing Configuration
 *
 * Provides pricing data for cost estimation across LLM providers.
 * Prices are in USD per 1M tokens.
 *
 * Default prices are conservative estimates.
 * Can be overridden via COST_MODEL_PRICING_JSON env var.
 */

import type { LLMProviderName } from '@/lib/llm/types';

/** Pricing per 1M tokens in USD */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Default pricing map for known models.
 * Updated January 2025 - prices may change.
 */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  // Gemini
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-2.0-flash-exp': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },

  // OpenAI
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },

  // Anthropic
  'claude-opus-4-20250514': { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-sonnet-4-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
};

/**
 * Provider default pricing (fallback when model not found).
 */
const PROVIDER_DEFAULTS: Record<LLMProviderName, ModelPricing> = {
  gemini: { inputPer1M: 0.10, outputPer1M: 0.40 },
  openai: { inputPer1M: 0.15, outputPer1M: 0.60 },
  anthropic: { inputPer1M: 3.00, outputPer1M: 15.00 },
};

/** Cached custom pricing from env */
let customPricingCache: Record<string, ModelPricing> | null = null;
let customPricingLoaded = false;

/**
 * Load custom pricing from COST_MODEL_PRICING_JSON env var.
 * Format: { "model-name": { "inputPer1M": 1.0, "outputPer1M": 2.0 } }
 */
function loadCustomPricing(): Record<string, ModelPricing> {
  if (customPricingLoaded) {
    return customPricingCache || {};
  }

  customPricingLoaded = true;

  const json = process.env.COST_MODEL_PRICING_JSON;
  if (!json) {
    customPricingCache = null;
    return {};
  }

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const result: Record<string, ModelPricing> = {};

    for (const [model, pricing] of Object.entries(parsed)) {
      if (
        pricing &&
        typeof pricing === 'object' &&
        'inputPer1M' in pricing &&
        'outputPer1M' in pricing &&
        typeof (pricing as ModelPricing).inputPer1M === 'number' &&
        typeof (pricing as ModelPricing).outputPer1M === 'number'
      ) {
        result[model] = pricing as ModelPricing;
      }
    }

    customPricingCache = result;
    return result;
  } catch {
    console.warn('Failed to parse COST_MODEL_PRICING_JSON:', json);
    customPricingCache = null;
    return {};
  }
}

/**
 * Get pricing for a specific model.
 * Checks custom pricing first, then default pricing, then provider defaults.
 *
 * @returns Pricing or null if cost tracking is disabled
 */
export function getModelPricing(
  provider: LLMProviderName,
  model: string
): ModelPricing | null {
  // Check if cost tracking is enabled
  if (process.env.COST_TRACKING_ENABLED === '0') {
    return null;
  }

  // Check custom pricing first
  const customPricing = loadCustomPricing();
  if (customPricing[model]) {
    return customPricing[model];
  }

  // Check default pricing
  if (DEFAULT_PRICING[model]) {
    return DEFAULT_PRICING[model];
  }

  // Check for partial model name matches (e.g., "gpt-4o-2024-01-01" matches "gpt-4o")
  for (const [key, pricing] of Object.entries(DEFAULT_PRICING)) {
    if (model.startsWith(key)) {
      return pricing;
    }
  }

  // Fall back to provider default
  return PROVIDER_DEFAULTS[provider] || null;
}

/**
 * Calculate estimated cost in USD.
 *
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param pricing Model pricing
 * @returns Estimated cost in USD, or null if pricing not available
 */
export function calculateCost(
  inputTokens: number | undefined | null,
  outputTokens: number | undefined | null,
  pricing: ModelPricing | null
): number | null {
  if (!pricing) {
    return null;
  }

  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;

  if (input === 0 && output === 0) {
    return null;
  }

  const inputCost = (input / 1_000_000) * pricing.inputPer1M;
  const outputCost = (output / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Check if cost tracking is enabled.
 */
export function isCostTrackingEnabled(): boolean {
  return process.env.COST_TRACKING_ENABLED !== '0';
}

