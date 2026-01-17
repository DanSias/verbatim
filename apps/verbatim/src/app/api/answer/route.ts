/**
 * POST /api/answer
 *
 * LLM-powered answer synthesis endpoint for Verbatim.
 * Uses retrieval internally and synthesizes a citation-backed answer.
 * Includes deterministic confidence scoring and ticket draft fallback.
 *
 * Hardening features:
 * - Request validation with zod schemas
 * - LLM timeout with AbortController
 * - In-memory rate limiting (pilot-safe)
 * - Structured logging
 * - Defensive caps on token usage and retrieval size
 *
 * Request:
 *   - workspaceId: string (required)
 *   - question: string (required)
 *   - corpusScope?: Array<'docs'|'kb'> (default both)
 *   - topK?: number (default 6, max 10)
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
import { retrieve, RetrievalError, type RetrievedChunk } from '@/lib/retrieval';
import {
  getLLMClient,
  getDefaultProvider,
  withLLMTimeout,
  getLLMTimeout,
  getLLMCaps,
  limitChunks,
  truncateExcerpt,
  LLMTimeoutError,
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
import {
  parseAnswerRequest,
  applyRateLimit,
  getClientIp,
  invalidJsonError,
  validationError,
  rateLimitError,
  llmTimeoutError,
  llmError,
  notFoundError,
  internalError,
} from '@/lib/http';
import {
  generateRequestId,
  truncateText,
  logRequestStart,
  logRequestEnd,
  logRateLimit,
  formatTopCitations,
} from '@/lib/observability/log';

// Force Node.js runtime
export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let workspaceId: string | undefined;
  let providerName: LLMProviderName = getDefaultProvider();

  try {
    // Parse and validate request body
    const parseResult = await parseAnswerRequest(request);
    if (!parseResult.success) {
      // Determine if it's a JSON parse error or validation error
      const isJsonError = parseResult.error.includes('Invalid JSON') || parseResult.error.includes('empty');
      if (isJsonError) {
        return invalidJsonError(parseResult.details);
      }
      return validationError(parseResult.error, parseResult.details);
    }

    const {
      workspaceId: wsId,
      question,
      topK,
      corpusScope,
      provider,
      forceTicketDraft,
      minConfidence,
    } = parseResult.data;

    workspaceId = wsId;
    if (provider) {
      providerName = provider;
    }

    // Apply rate limiting
    const rateLimitResult = applyRateLimit(request, workspaceId);
    if (!rateLimitResult.allowed) {
      logRateLimit('answer', {
        requestId,
        ip: getClientIp(request),
        workspaceId,
        current: rateLimitResult.current,
        limit: rateLimitResult.limit,
      });

      return rateLimitError(
        rateLimitResult.retryAfterSeconds,
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.resetTimestamp
      );
    }

    // Log request start
    logRequestStart('answer', {
      requestId,
      workspaceId,
      questionLength: question.length,
      questionPreview: truncateText(question, 80),
      corpusScope: corpusScope as string[],
      topK,
    });

    // Run retrieval
    const retrievalStartTime = Date.now();
    const retrieval = await retrieve({
      workspaceId,
      question,
      topK,
      corpusScope,
    });
    const retrievalLatencyMs = Date.now() - retrievalStartTime;

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

      const response: AnswerResponse = {
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
      };

      logRequestEnd('answer', {
        requestId,
        workspaceId,
        latencyMs: Date.now() - startTime,
        retrievalLatencyMs,
        provider: providerName,
        model: 'n/a',
        mode: 'ticket_draft',
        confidence: 'low',
        chunksUsed: 0,
      });

      return NextResponse.json(response);
    }

    // Build prompt and call LLM with timeout
    const llmStartTime = Date.now();
    let answer: string;
    let citations: AnswerCitation[];
    let model: string;
    let didTimeout = false;

    try {
      const llmResult = await generateAnswerWithTimeout(
        question,
        retrieval.chunks,
        providerName,
        mode
      );
      answer = llmResult.answer;
      citations = llmResult.citations;
      model = llmResult.model;
    } catch (error) {
      if (error instanceof LLMTimeoutError) {
        didTimeout = true;
        // Fall back to deterministic response on timeout
        answer = generateFallbackAnswer(retrieval.chunks, mode);
        citations = generateFallbackCitations(retrieval.chunks);
        model = 'fallback (timeout)';
      } else {
        throw error;
      }
    }
    const llmLatencyMs = Date.now() - llmStartTime;

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
        ...(didTimeout && { timeout: true }),
      },
    };

    // Log request end
    logRequestEnd('answer', {
      requestId,
      workspaceId,
      latencyMs: Date.now() - startTime,
      retrievalLatencyMs,
      llmLatencyMs,
      provider: providerName,
      model,
      mode,
      confidence,
      chunksUsed: retrieval.chunks.length,
      topCitations: formatTopCitations(finalCitations),
      timeout: didTimeout,
    });

    return NextResponse.json(response);
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Log error
    logRequestEnd('answer', {
      requestId,
      workspaceId: workspaceId || 'unknown',
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof RetrievalError ? error.code : 'INTERNAL_ERROR',
    });

    if (error instanceof LLMTimeoutError) {
      return llmTimeoutError(getLLMTimeout(), {
        requestId,
        provider: providerName,
      });
    }

    if (error instanceof RetrievalError) {
      if (error.code === 'NOT_FOUND') {
        return notFoundError(error.message, { requestId });
      }
      return internalError(error.message, { requestId, code: error.code });
    }

    // Check for LLM-specific errors
    if (error instanceof Error && error.message.includes('API error')) {
      return llmError(error.message, { requestId, provider: providerName });
    }

    return internalError('Internal server error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Generate an answer using the LLM with timeout protection.
 */
async function generateAnswerWithTimeout(
  question: string,
  chunks: RetrievedChunk[],
  providerName: LLMProviderName,
  mode: AnswerMode
): Promise<{ answer: string; citations: AnswerCitation[]; model: string }> {
  return withLLMTimeout(async (signal) => {
    return generateAnswer(question, chunks, providerName, mode, signal);
  });
}

/**
 * Generate an answer using the LLM.
 */
async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  providerName: LLMProviderName,
  mode: AnswerMode,
  signal?: AbortSignal
): Promise<{ answer: string; citations: AnswerCitation[]; model: string }> {
  const caps = getLLMCaps();

  // Apply defensive caps: limit chunks and truncate excerpts
  const limitedChunks = limitChunks(chunks, caps.maxChunks);

  // Build source context for the LLM with truncated excerpts
  const sourcesText = limitedChunks
    .map((chunk, i) => {
      const sourceNum = i + 1;
      const location =
        chunk.corpus === 'docs'
          ? `[Docs] ${chunk.route || '/'}${chunk.anchor ? '#' + chunk.anchor : ''}`
          : `[KB] ${chunk.sourcePath}`;
      const heading = chunk.headingPath.length > 0 ? chunk.headingPath.join(' > ') : 'No heading';
      const content = truncateExcerpt(chunk.content, caps.maxExcerptChars);

      return `[${sourceNum}] ${location}
Heading: ${heading}
Content:
${content}
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

  // Call LLM with caps
  const client = getLLMClient(providerName);
  const result = await client.generateText(messages, {
    temperature: caps.temperature,
    maxTokens: caps.maxTokens,
    signal,
  });

  // Parse citations from the answer
  const citations = extractCitationsFromAnswer(result.text, limitedChunks);

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
 * Generate a fallback answer when LLM times out or fails.
 */
function generateFallbackAnswer(chunks: RetrievedChunk[], mode: AnswerMode): string {
  if (chunks.length === 0) {
    return "I couldn't find any relevant information in the documentation to answer your question.";
  }

  const topChunk = chunks[0];
  const location =
    topChunk.corpus === 'docs'
      ? topChunk.route || '/'
      : topChunk.sourcePath;

  if (mode === 'ticket_draft') {
    return `I found some potentially relevant information at ${location} [1], but I wasn't able to generate a complete answer. Please review the source or contact support for more help.`;
  }

  return `Based on the available documentation, you may find relevant information at ${location} [1]. For a more detailed answer, please try again or consult the documentation directly.`;
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
