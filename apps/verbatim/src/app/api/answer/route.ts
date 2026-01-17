/**
 * POST /api/answer
 *
 * LLM-powered answer synthesis endpoint for Verbatim.
 * Uses retrieval internally and synthesizes a citation-backed answer.
 * Includes deterministic confidence scoring and ticket draft fallback.
 *
 * Request:
 *   - workspaceId: string (required)
 *   - question: string (required)
 *   - corpusScope?: Array<'docs'|'kb'> (default both)
 *   - topK?: number (default 6)
 *   - provider?: 'gemini' | 'openai' | 'anthropic' (optional override)
 *   - conversationId?: string (echoed back)
 *   - forceTicketDraft?: boolean (default false)
 *   - minConfidence?: 'high' | 'medium' | 'low' (optional threshold)
 *
 * Response:
 *   - question, workspaceId, answer, citations, suggestedRoutes
 *   - confidence: 'high' | 'medium' | 'low'
 *   - mode: 'answer' | 'ticket_draft'
 *   - ticketDraft?: TicketDraft (when mode is ticket_draft)
 *   - debug: includes confidenceSignals
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Corpus } from '@prisma/client';
import { retrieve, RetrievalError, type RetrievedChunk } from '@/lib/retrieval';
import {
  getLLMClient,
  getDefaultProvider,
  isValidProvider,
  type LLMProviderName,
  type LLMMessage,
} from '@/lib/llm';
import {
  computeConfidence,
  meetsConfidenceThreshold,
  generateTicketDraft,
  type ConfidenceLevel,
  type AnswerCitation,
  type TicketDraft,
  type AnswerMode,
  type AnswerDebug,
} from '@/lib/answer';

// Force Node.js runtime
export const runtime = 'nodejs';

/** Request body shape */
interface AnswerRequest {
  workspaceId: string;
  question: string;
  corpusScope?: Array<'docs' | 'kb'>;
  topK?: number;
  provider?: string;
  conversationId?: string;
  forceTicketDraft?: boolean;
  minConfidence?: ConfidenceLevel;
}

/** Response shape */
interface AnswerResponse {
  question: string;
  workspaceId: string;
  answer: string;
  citations: AnswerCitation[];
  suggestedRoutes: Array<{ route: string; title: string | null }>;
  confidence: ConfidenceLevel;
  mode: AnswerMode;
  ticketDraft?: TicketDraft;
  debug: AnswerDebug;
}

/** Error response shape */
interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/** Default values */
const DEFAULT_TOP_K = 6;
const DEFAULT_CORPUS_SCOPE: Corpus[] = ['docs', 'kb'];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnswerRequest;

    // Validate required fields
    if (!body.workspaceId) {
      return errorResponse('Missing required field: workspaceId', 'VALIDATION_ERROR', 400);
    }
    if (!body.question) {
      return errorResponse('Missing required field: question', 'VALIDATION_ERROR', 400);
    }

    const workspaceId = body.workspaceId;
    const question = body.question.trim();
    const topK = body.topK ?? DEFAULT_TOP_K;
    const corpusScope = validateCorpusScope(body.corpusScope) ?? DEFAULT_CORPUS_SCOPE;
    const forceTicketDraft = body.forceTicketDraft ?? false;
    const minConfidence = validateConfidenceLevel(body.minConfidence);

    // Validate and select provider
    let providerName: LLMProviderName = getDefaultProvider();
    if (body.provider) {
      if (!isValidProvider(body.provider)) {
        return errorResponse(
          `Invalid provider: ${body.provider}. Valid options: gemini, openai, anthropic`,
          'VALIDATION_ERROR',
          400
        );
      }
      providerName = body.provider;
    }

    // Run retrieval
    const retrieval = await retrieve({
      workspaceId,
      question,
      topK,
      corpusScope,
    });

    // Compute confidence from retrieval results
    const { confidence, signals } = computeConfidence(
      retrieval.results,
      retrieval.suggestedRoutes
    );

    // Determine mode based on confidence and request params
    const shouldUseTicketDraft =
      forceTicketDraft ||
      confidence === 'low' ||
      (minConfidence && !meetsConfidenceThreshold(confidence, minConfidence));

    const mode: AnswerMode = shouldUseTicketDraft ? 'ticket_draft' : 'answer';

    // Check if we have enough sources
    if (retrieval.chunks.length === 0) {
      // No sources - generate ticket draft
      const ticketDraft = generateTicketDraft({
        question,
        chunks: [],
        answer: undefined,
        citations: [],
      });

      return NextResponse.json({
        question,
        workspaceId,
        answer: "I couldn't find any relevant information in the documentation to answer your question.",
        citations: [],
        suggestedRoutes: [],
        confidence: 'low',
        mode: 'ticket_draft',
        ticketDraft,
        debug: {
          provider: providerName,
          model: 'n/a',
          retrievalMode: retrieval.debug.retrievalMode,
          topK,
          corpusScope: corpusScope as string[],
          chunksUsed: 0,
          confidenceSignals: signals,
        },
      } satisfies AnswerResponse);
    }

    // Build prompt and call LLM
    const { answer, citations, model } = await generateAnswer(
      question,
      retrieval.chunks,
      providerName,
      mode
    );

    // Ensure we have citations (fallback to deterministic if parsing failed)
    const finalCitations =
      citations.length > 0
        ? citations
        : generateFallbackCitations(retrieval.chunks);

    // Generate ticket draft if needed
    let ticketDraft: TicketDraft | undefined;
    if (mode === 'ticket_draft') {
      ticketDraft = generateTicketDraft({
        question,
        chunks: retrieval.chunks,
        answer,
        citations: finalCitations,
      });
    }

    const response: AnswerResponse = {
      question,
      workspaceId,
      answer,
      citations: finalCitations,
      suggestedRoutes: retrieval.suggestedRoutes,
      confidence,
      mode,
      ticketDraft,
      debug: {
        provider: providerName,
        model,
        retrievalMode: retrieval.debug.retrievalMode,
        topK,
        corpusScope: corpusScope as string[],
        chunksUsed: retrieval.chunks.length,
        confidenceSignals: signals,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Answer endpoint error:', error);

    if (error instanceof RetrievalError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 500;
      return errorResponse(error.message, error.code, status);
    }

    return errorResponse(
      'Internal server error',
      'INTERNAL_ERROR',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Generate an answer using the LLM.
 */
async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  providerName: LLMProviderName,
  mode: AnswerMode
): Promise<{ answer: string; citations: AnswerCitation[]; model: string }> {
  // Build source context for the LLM
  const sourcesText = chunks
    .map((chunk, i) => {
      const sourceNum = i + 1;
      const location =
        chunk.corpus === 'docs'
          ? `[Docs] ${chunk.route || '/'}${chunk.anchor ? '#' + chunk.anchor : ''}`
          : `[KB] ${chunk.sourcePath}`;
      const heading = chunk.headingPath.length > 0 ? chunk.headingPath.join(' > ') : 'No heading';

      return `[${sourceNum}] ${location}
Heading: ${heading}
Content:
${chunk.content.slice(0, 1500)}${chunk.content.length > 1500 ? '...' : ''}
`;
    })
    .join('\n---\n');

  // Build the prompt based on mode
  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt(question, sourcesText, mode);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Call LLM
  const client = getLLMClient(providerName);
  const result = await client.generateText(messages, {
    temperature: 0.3,
    maxTokens: 1024,
  });

  // Parse citations from the answer
  const citations = extractCitationsFromAnswer(result.text, chunks);

  // Get model name from provider
  const model = getModelName(providerName, result.raw);

  return {
    answer: result.text,
    citations,
    model,
  };
}

/**
 * Build system prompt based on mode.
 */
function buildSystemPrompt(mode: AnswerMode): string {
  const basePrompt = `You are a documentation assistant for a payment processing platform. Your role is to answer questions based ONLY on the provided sources.

RULES:
1. Use ONLY information from the provided sources - do not make up information.
2. Always cite your sources using numbered references like [1], [2], etc.
3. Each citation number corresponds to the source number in the provided context.
4. If the sources don't contain enough information, say so clearly.
5. Prefer information from [Docs] sources for navigation guidance.
6. Use [KB] sources for troubleshooting and operational details.`;

  if (mode === 'ticket_draft') {
    return `${basePrompt}

IMPORTANT: The user's question cannot be fully answered from the sources. Be brief and honest about the limitation. Suggest that a support ticket may be needed for more specific help.`;
  }

  return `${basePrompt}

Answer in 3-8 sentences, being concise and actionable.`;
}

/**
 * Build user prompt based on mode.
 */
function buildUserPrompt(question: string, sourcesText: string, mode: AnswerMode): string {
  if (mode === 'ticket_draft') {
    return `SOURCES:
${sourcesText}

QUESTION: ${question}

The available sources may not fully answer this question. Provide a brief response that:
1. Summarizes what relevant information exists in the sources (if any)
2. Clearly indicates what cannot be answered
3. Uses citations [1], [2] etc. where applicable

Keep your response under 4 sentences.`;
  }

  return `SOURCES:
${sourcesText}

QUESTION: ${question}

Please provide a concise answer with citations.`;
}

/**
 * Extract citation references from the answer text.
 */
function extractCitationsFromAnswer(
  answer: string,
  chunks: RetrievedChunk[]
): AnswerCitation[] {
  // Find all [N] references in the answer
  const citationRefs = answer.match(/\[(\d+)\]/g) || [];
  const uniqueRefs = [...new Set(citationRefs)];

  const citations: AnswerCitation[] = [];
  const seenIndices = new Set<number>();

  for (const ref of uniqueRefs) {
    const match = ref.match(/\[(\d+)\]/);
    if (!match) continue;

    const index = parseInt(match[1], 10);
    if (isNaN(index) || index < 1 || index > chunks.length) continue;
    if (seenIndices.has(index)) continue;

    seenIndices.add(index);
    const chunk = chunks[index - 1];

    if (chunk.corpus === 'docs') {
      const route = chunk.route || '/';
      const anchor = chunk.anchor;
      const url = anchor ? `${route}#${anchor}` : route;

      citations.push({
        index,
        corpus: 'docs',
        route,
        anchor,
        url,
      });
    } else {
      citations.push({
        index,
        corpus: 'kb',
        sourcePath: chunk.sourcePath,
      });
    }
  }

  // Sort by index
  citations.sort((a, b) => a.index - b.index);

  return citations;
}

/**
 * Generate fallback citations from top chunks when parsing fails.
 */
function generateFallbackCitations(chunks: RetrievedChunk[]): AnswerCitation[] {
  return chunks.slice(0, 3).map((chunk, i) => {
    const index = i + 1;

    if (chunk.corpus === 'docs') {
      const route = chunk.route || '/';
      const anchor = chunk.anchor;
      const url = anchor ? `${route}#${anchor}` : route;

      return {
        index,
        corpus: 'docs' as const,
        route,
        anchor,
        url,
      };
    }

    return {
      index,
      corpus: 'kb' as const,
      sourcePath: chunk.sourcePath,
    };
  });
}

/**
 * Get the model name from the provider response.
 */
function getModelName(providerName: LLMProviderName, raw: unknown): string {
  // Try to extract model from raw response
  if (raw && typeof raw === 'object') {
    const rawObj = raw as Record<string, unknown>;
    if (typeof rawObj.model === 'string') {
      return rawObj.model;
    }
    if (typeof rawObj.modelVersion === 'string') {
      return rawObj.modelVersion;
    }
  }

  // Fallback to default model names
  switch (providerName) {
    case 'gemini':
      return process.env.LLM_MODEL_GEMINI || 'gemini-2.0-flash';
    case 'openai':
      return process.env.LLM_MODEL_OPENAI || 'gpt-4o-mini';
    case 'anthropic':
      return process.env.LLM_MODEL_ANTHROPIC || 'claude-sonnet-4-20250514';
    default:
      return 'unknown';
  }
}

/**
 * Validate and normalize corpus scope.
 */
function validateCorpusScope(scope?: Array<'docs' | 'kb'>): Corpus[] | null {
  if (!scope || !Array.isArray(scope)) {
    return null;
  }

  const valid: Corpus[] = [];
  for (const s of scope) {
    if (s === 'docs' || s === 'kb') {
      valid.push(s);
    }
  }

  return valid.length > 0 ? valid : null;
}

/**
 * Validate confidence level parameter.
 */
function validateConfidenceLevel(level?: string): ConfidenceLevel | undefined {
  if (!level) return undefined;
  if (level === 'high' || level === 'medium' || level === 'low') {
    return level;
  }
  return undefined;
}

/**
 * Build an error response.
 */
function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  const error: ApiError = { error: message, code };
  if (details) {
    error.details = details;
  }
  return NextResponse.json(error, { status });
}
