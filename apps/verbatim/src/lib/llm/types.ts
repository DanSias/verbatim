/**
 * LLM Provider Types
 *
 * Shared types for the LLM abstraction layer.
 * Supports swappable providers (Gemini, OpenAI, Anthropic).
 */

/** Supported LLM providers */
export type LLMProviderName = 'gemini' | 'openai' | 'anthropic';

/** Message role for chat-style completions */
export type MessageRole = 'system' | 'user' | 'assistant';

/** A single message in a conversation */
export interface LLMMessage {
  role: MessageRole;
  content: string;
}

/** Options for text generation */
export interface LLMGenerateOptions {
  /** Model to use (provider-specific, falls back to env or default) */
  model?: string;
  /** Temperature for sampling (0-1, lower = more deterministic) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** AbortSignal for cancellation/timeout */
  signal?: AbortSignal;
}

/** Result from text generation */
export interface LLMGenerateResult {
  /** The generated text */
  text: string;
  /** Token usage information (if available) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  /** Raw response from the provider (for debugging) */
  raw?: unknown;
}

/** Provider interface that all LLM providers must implement */
export interface LLMProvider {
  /** Provider name */
  name: LLMProviderName;
  /** Generate text from messages */
  generateText(
    messages: LLMMessage[],
    options?: LLMGenerateOptions
  ): Promise<LLMGenerateResult>;
}

/** Configuration for provider selection */
export interface LLMConfig {
  /** Default provider (from env or fallback) */
  defaultProvider: LLMProviderName;
  /** Environment variable values */
  env: {
    googleApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    modelGemini?: string;
    modelOpenai?: string;
    modelAnthropic?: string;
  };
}
