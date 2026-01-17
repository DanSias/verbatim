/**
 * Gemini LLM Provider
 *
 * Fully functional implementation using Google's Gemini API.
 * Uses GOOGLE_API_KEY from environment.
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../types';

/** Default model for Gemini */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** Gemini API endpoint */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Convert our message format to Gemini format */
function toGeminiContents(messages: LLMMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini doesn't have a system role; prepend to first user message
      // or add as a user message if no other messages follow
      continue; // Handled below
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  return contents;
}

/** Extract system instruction from messages */
function extractSystemInstruction(messages: LLMMessage[]): string | undefined {
  const systemMsg = messages.find((m) => m.role === 'system');
  return systemMsg?.content;
}

/** Gemini content format */
interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/** Gemini API request body */
interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

/** Gemini API response */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: {
    message: string;
    code: number;
  };
}

/** Create a Gemini provider instance */
export function createGeminiProvider(apiKey: string, defaultModel?: string): LLMProvider {
  const model = defaultModel || DEFAULT_MODEL;

  return {
    name: 'gemini',

    async generateText(
      messages: LLMMessage[],
      options?: LLMGenerateOptions
    ): Promise<LLMGenerateResult> {
      const useModel = options?.model || model;
      const url = `${API_BASE}/${useModel}:generateContent?key=${apiKey}`;

      // Build request body
      const systemInstruction = extractSystemInstruction(messages);
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      const contents = toGeminiContents(nonSystemMessages);

      const requestBody: GeminiRequest = {
        contents,
      };

      // Add system instruction if present
      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      // Add generation config
      if (options?.temperature !== undefined || options?.maxTokens !== undefined) {
        requestBody.generationConfig = {};
        if (options.temperature !== undefined) {
          requestBody.generationConfig.temperature = options.temperature;
        }
        if (options.maxTokens !== undefined) {
          requestBody.generationConfig.maxOutputTokens = options.maxTokens;
        }
      }

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: GeminiResponse = await response.json();

      // Check for API error
      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message} (code: ${data.error.code})`);
      }

      if (!response.ok) {
        throw new Error(`Gemini API request failed: HTTP ${response.status}`);
      }

      // Extract text from response
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        text,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
        raw: data,
      };
    },
  };
}
