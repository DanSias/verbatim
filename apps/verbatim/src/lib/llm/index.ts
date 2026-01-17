/**
 * LLM Module
 *
 * Provider-agnostic LLM interface for Verbatim.
 * Supports swappable providers via environment variable or request override.
 *
 * Provider selection:
 * 1. Request-level override (provider parameter)
 * 2. LLM_PROVIDER environment variable
 * 3. Default: gemini
 *
 * Required environment variables per provider:
 * - Gemini: GOOGLE_API_KEY
 * - OpenAI: OPENAI_API_KEY
 * - Anthropic: ANTHROPIC_API_KEY
 *
 * Optional model overrides:
 * - LLM_MODEL_GEMINI
 * - LLM_MODEL_OPENAI
 * - LLM_MODEL_ANTHROPIC
 */

import type {
  LLMProviderName,
  LLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMConfig,
} from './types';
import { createGeminiProvider } from './providers/gemini';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';

// Re-export types
export type {
  LLMProviderName,
  LLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMGenerateResult,
};

/** Default provider when not specified */
const DEFAULT_PROVIDER: LLMProviderName = 'gemini';

/** Valid provider names */
const VALID_PROVIDERS: LLMProviderName[] = ['gemini', 'openai', 'anthropic'];

/**
 * Validate that a string is a valid provider name.
 */
export function isValidProvider(name: string): name is LLMProviderName {
  return VALID_PROVIDERS.includes(name as LLMProviderName);
}

/**
 * Get the LLM configuration from environment variables.
 */
export function getLLMConfig(): LLMConfig {
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  const defaultProvider = isValidProvider(envProvider || '')
    ? (envProvider as LLMProviderName)
    : DEFAULT_PROVIDER;

  return {
    defaultProvider,
    env: {
      googleApiKey: process.env.GOOGLE_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelGemini: process.env.LLM_MODEL_GEMINI,
      modelOpenai: process.env.LLM_MODEL_OPENAI,
      modelAnthropic: process.env.LLM_MODEL_ANTHROPIC,
    },
  };
}

/**
 * Get an LLM client for the specified provider.
 *
 * @param providerOverride - Optional provider name to override env setting
 * @returns LLM provider instance
 * @throws Error if API key is missing for the selected provider
 */
export function getLLMClient(providerOverride?: LLMProviderName): LLMProvider {
  const config = getLLMConfig();
  const providerName = providerOverride || config.defaultProvider;

  switch (providerName) {
    case 'gemini': {
      const apiKey = config.env.googleApiKey;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required for Gemini provider');
      }
      return createGeminiProvider(apiKey, config.env.modelGemini);
    }

    case 'openai': {
      const apiKey = config.env.openaiApiKey;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
      }
      return createOpenAIProvider(apiKey, config.env.modelOpenai);
    }

    case 'anthropic': {
      const apiKey = config.env.anthropicApiKey;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
      }
      return createAnthropicProvider(apiKey, config.env.modelAnthropic);
    }

    default:
      throw new Error(`Unknown LLM provider: ${providerName}`);
  }
}

/**
 * Generate text using the configured LLM provider.
 * Convenience function that combines provider selection and generation.
 *
 * @param messages - Array of messages for the conversation
 * @param options - Generation options
 * @param providerOverride - Optional provider name to use
 * @returns Generation result with text and usage info
 */
export async function generateText(
  messages: LLMMessage[],
  options?: LLMGenerateOptions,
  providerOverride?: LLMProviderName
): Promise<LLMGenerateResult> {
  const client = getLLMClient(providerOverride);
  return client.generateText(messages, options);
}

/**
 * Get the default provider name from configuration.
 */
export function getDefaultProvider(): LLMProviderName {
  return getLLMConfig().defaultProvider;
}
