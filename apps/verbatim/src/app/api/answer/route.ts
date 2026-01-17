/**
 * POST /api/answer
 *
 * LLM-powered answer synthesis endpoint for Verbatim.
 * Uses retrieval internally and synthesizes a citation-backed answer.
 *
 * Request:
 *   - workspaceId: string (required)
 *   - question: string (required)
 *   - corpusScope?: Array<'docs'|'kb'> (default both)
 *   - topK?: number (default 6)
 *   - provider?: 'gemini' | 'openai' | 'anthropic' (optional override)
 *   - conversationId?: string (echoed back)
 *
 * Response:
 *   - question, workspaceId, answer, citations, suggestedRoutes, debug
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
}

/** Citation in the response */
interface AnswerCitation {
  index: number;
  corpus: 'docs' | 'kb';
  route?: string;
  anchor?: string | null;
  url?: string;
  sourcePath?: string;
}

/** Response shape */
interface AnswerResponse {
  question: string;
  workspaceId: string;
  answer: string;
  citations: AnswerCitation[];
  suggestedRoutes: Array<{ route: string; title: string | null }>;
  debug: {
    provider: string;
    model: string;
    retrievalMode: 'vector' | 'keyword';
    topK: number;
    corpusScope: string[];
    chunksUsed: number;
  };
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

    // Check if we have enough sources
    if (retrieval.chunks.length === 0) {
      return NextResponse.json({
        question,
        workspaceId,
        answer: "I couldn't find any relevant information in the documentation to answer your question.",
        citations: [],
        suggestedRoutes: [],
        debug: {
          provider: providerName,
          model: 'n/a',
          retrievalMode: retrieval.debug.retrievalMode,
          topK,
          corpusScope: corpusScope as string[],
          chunksUsed: 0,
        },
      } satisfies AnswerResponse);
    }

    // Build prompt and call LLM
    const { answer, citations, model } = await generateAnswer(
      question,
      retrieval.chunks,
      providerName
    );

    const response: AnswerResponse = {
      question,
      workspaceId,
      answer,
      citations,
      suggestedRoutes: retrieval.suggestedRoutes,
      debug: {
        provider: providerName,
        model,
        retrievalMode: retrieval.debug.retrievalMode,
        topK,
        corpusScope: corpusScope as string[],
        chunksUsed: retrieval.chunks.length,
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
  providerName: LLMProviderName
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

  // Build the prompt
  const systemPrompt = `You are a documentation assistant for a payment processing platform. Your role is to answer questions based ONLY on the provided sources.

RULES:
1. Answer in 3-8 sentences, being concise and actionable.
2. Use ONLY information from the provided sources - do not make up information.
3. Always cite your sources using numbered references like [1], [2], etc.
4. If the sources don't contain enough information, say so clearly.
5. Prefer information from [Docs] sources for navigation guidance.
6. Use [KB] sources for troubleshooting and operational details.

CITATION FORMAT:
- Use [1], [2], etc. inline when referencing information
- Each citation number corresponds to the source number in the provided context

If you cannot answer the question from the sources, respond with:
"I don't have enough information in the documentation to fully answer this question. [Suggest creating a support ticket if needed]"`;

  const userPrompt = `SOURCES:
${sourcesText}

QUESTION: ${question}

Please provide a concise answer with citations.`;

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
