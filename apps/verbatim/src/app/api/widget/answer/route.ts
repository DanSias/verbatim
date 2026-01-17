/**
 * POST /api/widget/answer
 *
 * Proxy route for the docs widget.
 * Injects server-side configuration and forwards to /api/answer.
 *
 * This route is designed to be portable:
 * - In Verbatim: forwards to local /api/answer
 * - In docs repo: forward to VERBATIM_BASE_URL/api/answer
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
 *   - workspaceId from WIDGET_DEFAULT_WORKSPACE_ID (required)
 *   - Default values for corpusScope, minConfidence, provider
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  invalidJsonError,
  validationError,
  internalError,
} from '@/lib/http';

export const runtime = 'nodejs';

/** Client request body shape */
interface WidgetRequest {
  question: string;
  topK?: number;
  corpusScope?: Array<'docs' | 'kb'>;
  minConfidence?: 'low' | 'medium' | 'high';
  forceTicketDraft?: boolean;
  provider?: 'openai' | 'gemini' | 'anthropic';
}

/** Get widget configuration from environment */
function getWidgetConfig() {
  const workspaceId = process.env.WIDGET_DEFAULT_WORKSPACE_ID;
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

  // Parse corpus scope from comma-separated string
  let corpusScope: Array<'docs' | 'kb'> | undefined;
  if (corpusScopeEnv) {
    const parts = corpusScopeEnv.split(',').map((s) => s.trim().toLowerCase());
    const valid = parts.filter((p) => p === 'docs' || p === 'kb') as Array<'docs' | 'kb'>;
    if (valid.length > 0) {
      corpusScope = valid;
    }
  }

  return { workspaceId, corpusScope, minConfidence, provider };
}

export async function POST(request: NextRequest) {
  try {
    // Get server-side config
    const config = getWidgetConfig();

    if (!config.workspaceId) {
      return internalError('Widget not configured: WIDGET_DEFAULT_WORKSPACE_ID is required');
    }

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
      workspaceId: config.workspaceId,
      question,
      topK,
      corpusScope: corpusScope ?? config.corpusScope,
      minConfidence: minConfidence ?? config.minConfidence,
      forceTicketDraft: body.forceTicketDraft ?? false,
      provider: provider ?? config.provider,
    };

    // Forward to /api/answer using relative URL
    // This allows the same code to work regardless of host/port
    const upstreamUrl = new URL('/api/answer', request.url);

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    });

    // Forward the response (including error responses)
    const responseData = await upstreamResponse.json();

    return NextResponse.json(responseData, {
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
