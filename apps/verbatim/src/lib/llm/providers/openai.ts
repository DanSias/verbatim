/**
 * OpenAI LLM Provider
 *
 * Minimal implementation using OpenAI's Chat Completions API.
 * Uses OPENAI_API_KEY from environment.
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../types';

/** Default model for OpenAI */
const DEFAULT_MODEL = 'gpt-4o-mini';

/** OpenAI API endpoint */
const API_URL = 'https://api.openai.com/v1/chat/completions';

/** OpenAI message format */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** OpenAI API response */
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message: string;
    type: string;
  };
}

/** Create an OpenAI provider instance */
export function createOpenAIProvider(apiKey: string, defaultModel?: string): LLMProvider {
  const model = defaultModel || DEFAULT_MODEL;

  return {
    name: 'openai',

    async generateText(
      messages: LLMMessage[],
      options?: LLMGenerateOptions
    ): Promise<LLMGenerateResult> {
      const useModel = options?.model || model;

      // Convert messages to OpenAI format (same structure)
      const openaiMessages: OpenAIMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const requestBody: Record<string, unknown> = {
        model: useModel,
        messages: openaiMessages,
      };

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        requestBody.max_tokens = options.maxTokens;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });

      const data: OpenAIResponse = await response.json();

      if (data.error) {
        throw new Error(`OpenAI API error: ${data.error.message}`);
      }

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: HTTP ${response.status}`);
      }

      const text = data.choices?.[0]?.message?.content || '';

      return {
        text,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
        raw: data,
      };
    },
  };
}
