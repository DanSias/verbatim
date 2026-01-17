/**
 * Request Validation Utilities
 *
 * Validates and parses API request bodies using zod schemas.
 * Returns standardized errors on validation failure.
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';
import type { Corpus } from '@prisma/client';
import type { ConfidenceLevel } from '@/lib/answer';

/** Default values for request parameters */
const DEFAULTS = {
  topK: 6,
  corpusScope: ['docs', 'kb'] as Corpus[],
};

/** Maximum allowed topK to prevent abuse */
const MAX_TOP_K = 10;

/** Corpus scope enum for validation */
const corpusScopeSchema = z.enum(['docs', 'kb']);

/** Confidence level enum for validation */
const confidenceLevelSchema = z.enum(['high', 'medium', 'low']);

/** Provider enum for validation */
const providerSchema = z.enum(['gemini', 'openai', 'anthropic']);

/**
 * Schema for /api/ask requests
 */
export const askRequestSchema = z.object({
  workspaceId: z
    .string({ error: 'workspaceId is required' })
    .min(1, 'workspaceId cannot be empty'),
  question: z
    .string({ error: 'question is required' })
    .min(1, 'question cannot be empty')
    .max(2000, 'question exceeds maximum length of 2000 characters'),
  conversationId: z.string().optional(),
  topK: z
    .number()
    .int()
    .min(1, 'topK must be at least 1')
    .max(MAX_TOP_K, `topK cannot exceed ${MAX_TOP_K}`)
    .optional(),
  corpusScope: z.array(corpusScopeSchema).min(1).optional(),
});

export type AskRequestInput = z.input<typeof askRequestSchema>;
export type AskRequestParsed = z.output<typeof askRequestSchema>;

/**
 * Schema for /api/answer requests
 */
export const answerRequestSchema = z.object({
  workspaceId: z
    .string({ error: 'workspaceId is required' })
    .min(1, 'workspaceId cannot be empty'),
  question: z
    .string({ error: 'question is required' })
    .min(1, 'question cannot be empty')
    .max(2000, 'question exceeds maximum length of 2000 characters'),
  corpusScope: z.array(corpusScopeSchema).min(1).optional(),
  topK: z
    .number()
    .int()
    .min(1, 'topK must be at least 1')
    .max(MAX_TOP_K, `topK cannot exceed ${MAX_TOP_K}`)
    .optional(),
  provider: providerSchema.optional(),
  conversationId: z.string().optional(),
  forceTicketDraft: z.boolean().optional(),
  minConfidence: confidenceLevelSchema.optional(),
});

export type AnswerRequestInput = z.input<typeof answerRequestSchema>;
export type AnswerRequestParsed = z.output<typeof answerRequestSchema>;

/**
 * Result of parsing JSON from a request.
 */
export type ParseJsonResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, unknown> };

/**
 * Parse JSON from a NextRequest body.
 * Returns a result object to allow the caller to handle errors.
 */
export async function parseJson<T>(request: NextRequest): Promise<ParseJsonResult<T>> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return { success: false, error: 'Request body is empty' };
    }
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: 'Invalid JSON in request body',
      details: { message: err instanceof Error ? err.message : 'Parse error' },
    };
  }
}

/**
 * Result of validating a request body against a schema.
 */
export type ValidateResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, unknown> };

/**
 * Validate an object against a zod schema.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidateResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format zod errors into a readable message
  const issues = result.error.issues;
  const firstIssue = issues[0];
  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'request';
  const message = `${path}: ${firstIssue.message}`;

  return {
    success: false,
    error: message,
    details: {
      issues: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    },
  };
}

/**
 * Parse and validate an Ask request.
 * Returns normalized data with defaults applied.
 */
export async function parseAskRequest(
  request: NextRequest
): Promise<ValidateResult<{
  workspaceId: string;
  question: string;
  conversationId?: string;
  topK: number;
  corpusScope: Corpus[];
}>> {
  const jsonResult = await parseJson<unknown>(request);
  if (!jsonResult.success) {
    return jsonResult;
  }

  const validateResult = validate(askRequestSchema, jsonResult.data);
  if (!validateResult.success) {
    return validateResult;
  }

  const data = validateResult.data;
  return {
    success: true,
    data: {
      workspaceId: data.workspaceId,
      question: data.question.trim(),
      conversationId: data.conversationId,
      topK: Math.min(data.topK ?? DEFAULTS.topK, MAX_TOP_K),
      corpusScope: (data.corpusScope as Corpus[]) ?? DEFAULTS.corpusScope,
    },
  };
}

/**
 * Parse and validate an Answer request.
 * Returns normalized data with defaults applied.
 */
export async function parseAnswerRequest(
  request: NextRequest
): Promise<ValidateResult<{
  workspaceId: string;
  question: string;
  topK: number;
  corpusScope: Corpus[];
  provider?: 'gemini' | 'openai' | 'anthropic';
  conversationId?: string;
  forceTicketDraft: boolean;
  minConfidence?: ConfidenceLevel;
}>> {
  const jsonResult = await parseJson<unknown>(request);
  if (!jsonResult.success) {
    return jsonResult;
  }

  const validateResult = validate(answerRequestSchema, jsonResult.data);
  if (!validateResult.success) {
    return validateResult;
  }

  const data = validateResult.data;
  return {
    success: true,
    data: {
      workspaceId: data.workspaceId,
      question: data.question.trim(),
      topK: Math.min(data.topK ?? DEFAULTS.topK, MAX_TOP_K),
      corpusScope: (data.corpusScope as Corpus[]) ?? DEFAULTS.corpusScope,
      provider: data.provider,
      conversationId: data.conversationId,
      forceTicketDraft: data.forceTicketDraft ?? false,
      minConfidence: data.minConfidence as ConfidenceLevel | undefined,
    },
  };
}
