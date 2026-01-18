/**
 * Tests for LLM usage extraction utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractUsage,
  extractUsageFromRaw,
  extractUsageFromUpstreamResponse,
} from '../usage';
import type { LLMGenerateResult } from '../types';

describe('Usage Extraction', () => {
  describe('extractUsage', () => {
    it('extracts usage from structured result for Gemini', () => {
      const result: LLMGenerateResult = {
        text: 'Hello',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        raw: {},
      };

      const usage = extractUsage(result, 'gemini');
      expect(usage).not.toBeNull();
      expect(usage!.inputTokens).toBe(100);
      expect(usage!.outputTokens).toBe(50);
      expect(usage!.totalTokens).toBe(150);
    });

    it('extracts usage from structured result for OpenAI', () => {
      const result: LLMGenerateResult = {
        text: 'Hello',
        usage: {
          inputTokens: 200,
          outputTokens: 100,
        },
        raw: {},
      };

      const usage = extractUsage(result, 'openai');
      expect(usage).not.toBeNull();
      expect(usage!.inputTokens).toBe(200);
      expect(usage!.outputTokens).toBe(100);
      expect(usage!.totalTokens).toBe(300);
    });

    it('returns null when no usage available', () => {
      const result: LLMGenerateResult = {
        text: 'Hello',
      };

      const usage = extractUsage(result, 'gemini');
      expect(usage).toBeNull();
    });
  });

  describe('extractUsageFromRaw', () => {
    describe('Gemini', () => {
      it('extracts from Gemini response format', () => {
        const raw = {
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 75,
          },
        };

        const usage = extractUsageFromRaw(raw, 'gemini');
        expect(usage).not.toBeNull();
        expect(usage!.inputTokens).toBe(150);
        expect(usage!.outputTokens).toBe(75);
        expect(usage!.totalTokens).toBe(225);
      });

      it('returns null for empty Gemini response', () => {
        const raw = {};
        const usage = extractUsageFromRaw(raw, 'gemini');
        expect(usage).toBeNull();
      });
    });

    describe('OpenAI', () => {
      it('extracts from OpenAI response format', () => {
        const raw = {
          usage: {
            prompt_tokens: 120,
            completion_tokens: 80,
            total_tokens: 200,
          },
        };

        const usage = extractUsageFromRaw(raw, 'openai');
        expect(usage).not.toBeNull();
        expect(usage!.inputTokens).toBe(120);
        expect(usage!.outputTokens).toBe(80);
        expect(usage!.totalTokens).toBe(200);
      });

      it('calculates total if not provided', () => {
        const raw = {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
          },
        };

        const usage = extractUsageFromRaw(raw, 'openai');
        expect(usage).not.toBeNull();
        expect(usage!.totalTokens).toBe(150);
      });
    });

    describe('Anthropic', () => {
      it('extracts from Anthropic response format', () => {
        const raw = {
          usage: {
            input_tokens: 180,
            output_tokens: 90,
          },
        };

        const usage = extractUsageFromRaw(raw, 'anthropic');
        expect(usage).not.toBeNull();
        expect(usage!.inputTokens).toBe(180);
        expect(usage!.outputTokens).toBe(90);
        expect(usage!.totalTokens).toBe(270);
      });

      it('returns null for empty Anthropic response', () => {
        const raw = {};
        const usage = extractUsageFromRaw(raw, 'anthropic');
        expect(usage).toBeNull();
      });
    });

    it('returns null for null raw input', () => {
      const usage = extractUsageFromRaw(null, 'gemini');
      expect(usage).toBeNull();
    });

    it('returns null for non-object raw input', () => {
      const usage = extractUsageFromRaw('string', 'gemini');
      expect(usage).toBeNull();
    });
  });

  describe('extractUsageFromUpstreamResponse', () => {
    it('extracts usage from debug object', () => {
      const response = {
        answer: 'Hello',
        debug: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      };

      const usage = extractUsageFromUpstreamResponse(response);
      expect(usage).not.toBeNull();
      expect(usage!.inputTokens).toBe(100);
      expect(usage!.outputTokens).toBe(50);
      expect(usage!.totalTokens).toBe(150);
    });

    it('extracts usage from top-level usage object (camelCase)', () => {
      const response = {
        answer: 'Hello',
        usage: {
          inputTokens: 200,
          outputTokens: 100,
        },
      };

      const usage = extractUsageFromUpstreamResponse(response);
      expect(usage).not.toBeNull();
      expect(usage!.inputTokens).toBe(200);
      expect(usage!.outputTokens).toBe(100);
      expect(usage!.totalTokens).toBe(300);
    });

    it('extracts usage from top-level usage object (snake_case)', () => {
      const response = {
        answer: 'Hello',
        usage: {
          input_tokens: 150,
          output_tokens: 75,
        },
      };

      const usage = extractUsageFromUpstreamResponse(response);
      expect(usage).not.toBeNull();
      expect(usage!.inputTokens).toBe(150);
      expect(usage!.outputTokens).toBe(75);
    });

    it('returns null for response without usage', () => {
      const response = {
        answer: 'Hello',
        confidence: 'high',
      };

      const usage = extractUsageFromUpstreamResponse(response);
      expect(usage).toBeNull();
    });

    it('returns null for null response', () => {
      const usage = extractUsageFromUpstreamResponse(null);
      expect(usage).toBeNull();
    });

    it('returns null for non-object response', () => {
      const usage = extractUsageFromUpstreamResponse('string');
      expect(usage).toBeNull();
    });
  });
});
