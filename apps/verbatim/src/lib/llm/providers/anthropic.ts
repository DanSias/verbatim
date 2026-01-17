/**
 * Anthropic LLM Provider
 *
 * Minimal implementation using Anthropic's Messages API.
 * Uses ANTHROPIC_API_KEY from environment.
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../types';

/** Default model for Anthropic */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/** Anthropic API endpoint */
const API_URL = 'https://api.anthropic.com/v1/messages';

/** Anthropic API version */
const API_VERSION = '2023-06-01';

/** Anthropic message format */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Anthropic API response */
interface AnthropicResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message: string;
    type: string;
  };
}

/** Create an Anthropic provider instance */
export function createAnthropicProvider(apiKey: string, defaultModel?: string): LLMProvider {
  const model = defaultModel || DEFAULT_MODEL;

  return {
    name: 'anthropic',

    async generateText(
      messages: LLMMessage[],
      options?: LLMGenerateOptions
    ): Promise<LLMGenerateResult> {
      const useModel = options?.model || model;

      // Extract system message
      const systemMsg = messages.find((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      // Convert to Anthropic format (no system role in messages array)
      const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const requestBody: Record<string, unknown> = {
        model: useModel,
        messages: anthropicMessages,
        max_tokens: options?.maxTokens || 4096,
      };

      if (systemMsg) {
        requestBody.system = systemMsg.content;
      }

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(requestBody),
      });

      const data: AnthropicResponse = await response.json();

      if (data.error) {
        throw new Error(`Anthropic API error: ${data.error.message}`);
      }

      if (!response.ok) {
        throw new Error(`Anthropic API request failed: HTTP ${response.status}`);
      }

      // Extract text from response
      const textBlock = data.content?.find((c) => c.type === 'text');
      const text = textBlock?.text || '';

      return {
        text,
        usage: {
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
        },
        raw: data,
      };
    },
  };
}
