/**
 * Unit tests for request validation utilities.
 *
 * Tests zod schema validation without network or database calls.
 */

import { describe, it, expect } from 'vitest';
import {
  validate,
  askRequestSchema,
  answerRequestSchema,
} from '../validate';

describe('askRequestSchema', () => {
  describe('valid requests', () => {
    it('accepts minimal valid request', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'How do I authenticate?',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workspaceId).toBe('ws_123');
        expect(result.data.question).toBe('How do I authenticate?');
      }
    });

    it('accepts request with all optional fields', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test question',
        conversationId: 'conv_456',
        topK: 5,
        corpusScope: ['docs', 'kb'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topK).toBe(5);
        expect(result.data.corpusScope).toEqual(['docs', 'kb']);
      }
    });

    it('accepts docs-only corpus scope', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        corpusScope: ['docs'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid requests', () => {
    it('rejects missing workspaceId', () => {
      const result = validate(askRequestSchema, {
        question: 'Test question',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('workspaceId');
      }
    });

    it('rejects empty workspaceId', () => {
      const result = validate(askRequestSchema, {
        workspaceId: '',
        question: 'Test question',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing question', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('question');
      }
    });

    it('rejects empty question', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects question exceeding max length', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('2000');
      }
    });

    it('rejects topK below minimum', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        topK: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects topK above maximum', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        topK: 11,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('10');
      }
    });

    it('rejects invalid corpus scope values', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        corpusScope: ['docs', 'invalid'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty corpus scope array', () => {
      const result = validate(askRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        corpusScope: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('answerRequestSchema', () => {
  describe('valid requests', () => {
    it('accepts minimal valid request', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'How do I setup webhooks?',
      });
      expect(result.success).toBe(true);
    });

    it('accepts request with provider override', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        provider: 'anthropic',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('anthropic');
      }
    });

    it('accepts request with forceTicketDraft', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        forceTicketDraft: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.forceTicketDraft).toBe(true);
      }
    });

    it('accepts request with minConfidence', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        minConfidence: 'high',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minConfidence).toBe('high');
      }
    });

    it('accepts all valid provider values', () => {
      for (const provider of ['gemini', 'openai', 'anthropic']) {
        const result = validate(answerRequestSchema, {
          workspaceId: 'ws_123',
          question: 'Test',
          provider,
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts all valid confidence levels', () => {
      for (const level of ['high', 'medium', 'low']) {
        const result = validate(answerRequestSchema, {
          workspaceId: 'ws_123',
          question: 'Test',
          minConfidence: level,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('invalid requests', () => {
    it('rejects invalid provider', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        provider: 'invalid-provider',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid minConfidence', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        minConfidence: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean forceTicketDraft', () => {
      const result = validate(answerRequestSchema, {
        workspaceId: 'ws_123',
        question: 'Test',
        forceTicketDraft: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('validate helper', () => {
  it('returns detailed error information', () => {
    const result = validate(askRequestSchema, {
      workspaceId: 123, // wrong type
      question: 'Test',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.details).toBeDefined();
      expect(result.details?.issues).toBeInstanceOf(Array);
    }
  });

  it('returns first error in message', () => {
    const result = validate(askRequestSchema, {});

    expect(result.success).toBe(false);
    if (!result.success) {
      // Should mention one of the required fields
      expect(result.error).toMatch(/workspaceId|question/);
    }
  });
});
