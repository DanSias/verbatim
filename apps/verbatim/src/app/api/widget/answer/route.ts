/**
 * POST /api/widget/answer
 *
 * Proxy route for the docs widget.
 * Injects server-side configuration and forwards to /api/answer.
 *
 * This route is designed to be portable:
 * - In Verbatim: WIDGET_UPSTREAM_MODE=local forwards to local /api/answer
 * - In docs repo: WIDGET_UPSTREAM_MODE=remote forwards to VERBATIM_BASE_URL/api/answer
 *
 * Client request (simplified):
 *   - question: string (required)
 *   - topK?: number (1-10)
 *   - corpusScope?: Array<'docs'|'kb'>
 *   - minConfidence?: 'low'|'medium'|'high'
 *   - forceTicketDraft?: boolean
 *   - provider?: 'openai'|'gemini'|'anthropic'
 *
 * Server-injected from env:
 *   - workspaceId from header x-verbatim-workspace-id or WIDGET_DEFAULT_WORKSPACE_ID
 *   - Default values for corpusScope, minConfidence, provider
 *
 * IMPORTANT: This route ALWAYS returns JSON, never HTML errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  invalidJsonError,
  validationError,
  internalError,
  jsonError,
  type ErrorCode,
} from '@/lib/http';
import { logQueryEventAsync } from '@/lib/logging';
import { extractUsageFromUpstreamResponse, type LLMProviderName } from '@/lib/llm';

export const runtime = 'nodejs';

/** Upstream timeout in milliseconds */
const UPSTREAM_TIMEOUT_MS = 20000;

/** Client request body shape */
interface WidgetRequest {
  question: string;
  topK?: number;
  corpusScope?: Array<'docs' | 'kb'>;
  minConfidence?: 'low' | 'medium' | 'high';
  forceTicketDraft?: boolean;
  provider?: 'openai' | 'gemini' | 'anthropic';
}

/** Upstream mode configuration */
type UpstreamMode = 'local' | 'remote';

/** Get widget configuration from environment */
function getWidgetConfig() {
  const defaultWorkspaceId = process.env.WIDGET_DEFAULT_WORKSPACE_ID;
  const corpusScopeEnv = process.env.WIDGET_DEFAULT_CORPUS_SCOPE;
  const minConfidence = process.env.WIDGET_DEFAULT_MIN_CONFIDENCE as
    | 'low'
    | 'medium'
    | 'high'
    | undefined;
  const provider = process.env.WIDGET_DEFAULT_PROVIDER as
    | 'openai'
    | 'gemini'
    | 'anthropic'
    | undefined;

  // Upstream configuration
  const upstreamMode = (process.env.WIDGET_UPSTREAM_MODE || 'local') as UpstreamMode;
  const verbatimBaseUrl = process.env.VERBATIM_BASE_URL;
  const verbatimApiKey = process.env.VERBATIM_API_KEY;

  // Parse corpus scope from comma-separated string
  let corpusScope: Array<'docs' | 'kb'> | undefined;
  if (corpusScopeEnv) {
    const parts = corpusScopeEnv.split(',').map((s) => s.trim().toLowerCase());
    const valid = parts.filter((p) => p === 'docs' || p === 'kb') as Array<'docs' | 'kb'>;
    if (valid.length > 0) {
      corpusScope = valid;
    }
  }

  return {
    defaultWorkspaceId,
    corpusScope,
    minConfidence,
    provider,
    upstreamMode,
    verbatimBaseUrl,
    verbatimApiKey,
  };
}

/**
 * Resolve workspace ID from request header or env default.
 * Header takes precedence for pilot testing.
 */
function resolveWorkspaceId(request: NextRequest, defaultWorkspaceId?: string): string | null {
  // Check for pilot override header
  const headerWorkspaceId = request.headers.get('x-verbatim-workspace-id');
  if (headerWorkspaceId && headerWorkspaceId.trim()) {
    return headerWorkspaceId.trim();
  }

  // Fall back to env default
  if (defaultWorkspaceId && defaultWorkspaceId.trim()) {
    return defaultWorkspaceId.trim();
  }

  return null;
}

/**
 * Build upstream URL based on mode.
 */
function buildUpstreamUrl(
  request: NextRequest,
  mode: UpstreamMode,
  verbatimBaseUrl?: string
): { url: string; error?: never } | { url?: never; error: string } {
  if (mode === 'remote') {
    if (!verbatimBaseUrl) {
      return { error: 'VERBATIM_BASE_URL is required when WIDGET_UPSTREAM_MODE=remote' };
    }
    // Ensure no trailing slash
    const baseUrl = verbatimBaseUrl.replace(/\/+$/, '');
    return { url: `${baseUrl}/api/answer` };
  }

  // Local mode: use relative URL
  const url = new URL('/api/answer', request.url);
  return { url: url.toString() };
}

/**
 * Safely parse JSON response, returning error details if parsing fails.
 */
async function safeParseJsonResponse(
  response: Response
): Promise<{ data: unknown; error?: never } | { data?: never; error: string; snippet: string }> {
  try {
    const text = await response.text();

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      return { data };
    } catch {
      // Not JSON - return truncated snippet
      const snippet = text.length > 500 ? text.slice(0, 500) + '...' : text;
      return {
        error: 'Upstream returned non-JSON response',
        snippet,
      };
    }
  } catch (err) {
    return {
      error: 'Failed to read upstream response',
      snippet: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get server-side config
    const config = getWidgetConfig();

    // Resolve workspace ID (header override or env default)
    const workspaceId = resolveWorkspaceId(request, config.defaultWorkspaceId);
    if (!workspaceId) {
      return validationError(
        'workspaceId is required: set WIDGET_DEFAULT_WORKSPACE_ID or pass x-verbatim-workspace-id header'
      );
    }

    // Build upstream URL
    const upstreamResult = buildUpstreamUrl(request, config.upstreamMode, config.verbatimBaseUrl);
    if (upstreamResult.error) {
      return internalError(upstreamResult.error);
    }
    // TypeScript narrowing - url is guaranteed to exist after error check
    const upstreamUrl = upstreamResult.url!;

    // Parse client request
    let body: WidgetRequest;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return invalidJsonError({ message: 'Request body is empty' });
      }
      body = JSON.parse(text) as WidgetRequest;
    } catch {
      return invalidJsonError({ message: 'Invalid JSON in request body' });
    }

    // Validate required fields
    if (!body.question || typeof body.question !== 'string') {
      return validationError('question is required and must be a string');
    }

    const question = body.question.trim();
    if (question.length === 0) {
      return validationError('question cannot be empty');
    }
    if (question.length > 2000) {
      return validationError('question exceeds maximum length of 2000 characters');
    }

    // Clamp topK to valid range
    let topK = body.topK;
    if (topK !== undefined) {
      if (typeof topK !== 'number' || isNaN(topK)) {
        topK = undefined;
      } else {
        topK = Math.max(1, Math.min(10, Math.floor(topK)));
      }
    }

    // Validate corpusScope
    let corpusScope = body.corpusScope;
    if (corpusScope !== undefined) {
      if (!Array.isArray(corpusScope)) {
        corpusScope = undefined;
      } else {
        const valid = corpusScope.filter((s) => s === 'docs' || s === 'kb');
        corpusScope = valid.length > 0 ? (valid as Array<'docs' | 'kb'>) : undefined;
      }
    }

    // Validate minConfidence
    let minConfidence = body.minConfidence;
    if (minConfidence && !['low', 'medium', 'high'].includes(minConfidence)) {
      minConfidence = undefined;
    }

    // Validate provider
    let provider = body.provider;
    if (provider && !['openai', 'gemini', 'anthropic'].includes(provider)) {
      provider = undefined;
    }

    // Build upstream request, applying defaults from config
    const upstreamBody = {
      workspaceId,
      question,
      topK,
      corpusScope: corpusScope ?? config.corpusScope,
      minConfidence: minConfidence ?? config.minConfidence,
      forceTicketDraft: body.forceTicketDraft ?? false,
      provider: provider ?? config.provider,
    };

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key for remote mode if configured
    if (config.verbatimApiKey) {
      headers['Authorization'] = `Bearer ${config.verbatimApiKey}`;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      // Check if it was an abort (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        return jsonError(
          'UPSTREAM_TIMEOUT' as ErrorCode,
          `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms`,
          504,
          { timeoutMs: UPSTREAM_TIMEOUT_MS }
        );
      }

      // Network error
      return internalError('Failed to connect to upstream', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse upstream response safely (always return JSON)
    const parseResult = await safeParseJsonResponse(upstreamResponse);

    if (parseResult.error) {
      // Upstream returned non-JSON (e.g., HTML error page)
      return jsonError(
        'UPSTREAM_ERROR' as ErrorCode,
        parseResult.error,
        502,
        {
          upstreamStatus: upstreamResponse.status,
          snippet: parseResult.snippet,
        }
      );
    }

    // Log query event for remote mode only (local mode logs in /api/answer)
    if (config.upstreamMode === 'remote' && upstreamResponse.ok) {
      const latencyMs = Date.now() - startTime;
      const responseData = parseResult.data as Record<string, unknown>;

      // Extract data from upstream response
      const confidence = (responseData.confidence as string) || 'low';
      const mode = (responseData.mode as string) || 'answer';
      const debug = responseData.debug as Record<string, unknown> | undefined;
      const providerRaw = (debug?.provider as string) || 'gemini';
      // Validate provider is a known type, default to gemini
      const provider: LLMProviderName = ['gemini', 'openai', 'anthropic'].includes(providerRaw)
        ? (providerRaw as LLMProviderName)
        : 'gemini';
      const model = (debug?.model as string) || 'unknown';
      const chunksUsed = (debug?.chunksUsed as number) || undefined;

      // Extract usage from upstream response
      const usage = extractUsageFromUpstreamResponse(responseData);

      logQueryEventAsync({
        workspaceId,
        source: 'widget',
        endpoint: '/api/widget/answer',
        provider,
        model,
        mode: mode as 'answer' | 'ticket_draft',
        confidence: confidence as 'high' | 'medium' | 'low',
        corpusScope: upstreamBody.corpusScope ?? ['docs', 'kb'],
        topK: upstreamBody.topK ?? 6,
        question,
        latencyMs,
        chunksUsed,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
      });
    }

    // Forward the JSON response (including error responses)
    return NextResponse.json(parseResult.data, {
      status: upstreamResponse.status,
      headers: {
        // Forward rate limit headers if present
        ...(upstreamResponse.headers.get('X-RateLimit-Limit') && {
          'X-RateLimit-Limit': upstreamResponse.headers.get('X-RateLimit-Limit')!,
        }),
        ...(upstreamResponse.headers.get('X-RateLimit-Remaining') && {
          'X-RateLimit-Remaining': upstreamResponse.headers.get('X-RateLimit-Remaining')!,
        }),
        ...(upstreamResponse.headers.get('X-RateLimit-Reset') && {
          'X-RateLimit-Reset': upstreamResponse.headers.get('X-RateLimit-Reset')!,
        }),
        ...(upstreamResponse.headers.get('Retry-After') && {
          'Retry-After': upstreamResponse.headers.get('Retry-After')!,
        }),
      },
    });
  } catch (error) {
    console.error('Widget proxy error:', error);
    return internalError('Widget proxy error', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
