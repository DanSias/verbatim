/**
 * GET /api/widget/config
 *
 * Returns public widget configuration (no secrets).
 * Used by the widget install page to show current config.
 *
 * Response:
 *   - enabled: boolean
 *   - upstreamMode: 'local' | 'remote'
 *   - verbatimBaseUrlSet: boolean (never expose actual URL)
 *   - verbatimApiKeySet: boolean (never expose actual key)
 *   - defaultWorkspaceId: string | null
 *   - defaultCorpusScope: string[] | null
 *   - defaultMinConfidence: string | null
 *   - defaultProvider: string | null
 *
 * IMPORTANT: This endpoint NEVER exposes secret values (API keys, etc.)
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Widget configuration response (public, no secrets) */
interface WidgetConfigResponse {
  enabled: boolean;
  upstreamMode: 'local' | 'remote';
  verbatimBaseUrlSet: boolean;
  verbatimApiKeySet: boolean;
  defaultWorkspaceId: string | null;
  defaultCorpusScope: string[] | null;
  defaultMinConfidence: string | null;
  defaultProvider: string | null;
}

export async function GET() {
  // Parse corpus scope from env
  let corpusScope: string[] | null = null;
  const corpusScopeEnv = process.env.WIDGET_DEFAULT_CORPUS_SCOPE;
  if (corpusScopeEnv) {
    const parts = corpusScopeEnv.split(',').map((s) => s.trim().toLowerCase());
    const valid = parts.filter((p) => p === 'docs' || p === 'kb');
    if (valid.length > 0) {
      corpusScope = valid;
    }
  }

  // Validate minConfidence
  let minConfidence: string | null = null;
  const minConfidenceEnv = process.env.WIDGET_DEFAULT_MIN_CONFIDENCE;
  if (minConfidenceEnv && ['low', 'medium', 'high'].includes(minConfidenceEnv)) {
    minConfidence = minConfidenceEnv;
  }

  // Validate provider
  let provider: string | null = null;
  const providerEnv = process.env.WIDGET_DEFAULT_PROVIDER;
  if (providerEnv && ['gemini', 'openai', 'anthropic'].includes(providerEnv)) {
    provider = providerEnv;
  }

  const config: WidgetConfigResponse = {
    enabled: process.env.NEXT_PUBLIC_WIDGET_ENABLED === '1',
    upstreamMode: (process.env.WIDGET_UPSTREAM_MODE || 'local') as 'local' | 'remote',
    verbatimBaseUrlSet: !!process.env.VERBATIM_BASE_URL,
    verbatimApiKeySet: !!process.env.VERBATIM_API_KEY,
    defaultWorkspaceId: process.env.WIDGET_DEFAULT_WORKSPACE_ID || null,
    defaultCorpusScope: corpusScope,
    defaultMinConfidence: minConfidence,
    defaultProvider: provider,
  };

  return NextResponse.json(config);
}
