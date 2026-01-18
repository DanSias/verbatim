/**
 * Integration tests for /api/widget/config endpoint.
 *
 * Tests the public configuration endpoint including:
 * - Always returning JSON responses
 * - Never exposing secret values
 * - Proper environment variable parsing
 *
 * See Phase 8.4 for widget install kit specification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/widget/config/route';

// Store original env values
const originalEnv: Record<string, string | undefined> = {};

// Response type from /api/widget/config
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

/**
 * Helper to parse response JSON and verify it's valid JSON
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  // Verify response is valid JSON (not HTML error page)
  expect(text).not.toMatch(/^<!DOCTYPE/i);
  expect(text).not.toMatch(/^<html/i);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Response is not valid JSON: ${text.slice(0, 200)}`);
  }
}

describe('Integration: /api/widget/config', () => {
  // Save and clear all widget-related env vars before each test
  beforeEach(() => {
    const envVars = [
      'NEXT_PUBLIC_WIDGET_ENABLED',
      'WIDGET_UPSTREAM_MODE',
      'VERBATIM_BASE_URL',
      'VERBATIM_API_KEY',
      'WIDGET_DEFAULT_WORKSPACE_ID',
      'WIDGET_DEFAULT_CORPUS_SCOPE',
      'WIDGET_DEFAULT_MIN_CONFIDENCE',
      'WIDGET_DEFAULT_PROVIDER',
    ];

    envVars.forEach((key) => {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    });
  });

  // Restore env vars after each test
  afterEach(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe('Response Format', () => {
    it('returns valid JSON', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(response.status).toBe(200);
      expect(typeof data).toBe('object');
    });

    it('includes all required fields', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data).toHaveProperty('enabled');
      expect(data).toHaveProperty('upstreamMode');
      expect(data).toHaveProperty('verbatimBaseUrlSet');
      expect(data).toHaveProperty('verbatimApiKeySet');
      expect(data).toHaveProperty('defaultWorkspaceId');
      expect(data).toHaveProperty('defaultCorpusScope');
      expect(data).toHaveProperty('defaultMinConfidence');
      expect(data).toHaveProperty('defaultProvider');
    });
  });

  describe('Secret Protection', () => {
    it('never exposes actual VERBATIM_BASE_URL value', async () => {
      process.env.VERBATIM_BASE_URL = 'https://secret-url.internal.example.com';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);
      const text = JSON.stringify(data);

      // Should indicate it's set, but not expose the value
      expect(data.verbatimBaseUrlSet).toBe(true);
      expect(text).not.toContain('secret-url');
      expect(text).not.toContain('internal.example.com');
    });

    it('never exposes actual VERBATIM_API_KEY value', async () => {
      process.env.VERBATIM_API_KEY = 'super-secret-api-key-12345';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);
      const text = JSON.stringify(data);

      // Should indicate it's set, but not expose the value
      expect(data.verbatimApiKeySet).toBe(true);
      expect(text).not.toContain('super-secret');
      expect(text).not.toContain('12345');
    });
  });

  describe('Environment Variable Parsing', () => {
    it('returns enabled=false when NEXT_PUBLIC_WIDGET_ENABLED is not set', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.enabled).toBe(false);
    });

    it('returns enabled=true when NEXT_PUBLIC_WIDGET_ENABLED=1', async () => {
      process.env.NEXT_PUBLIC_WIDGET_ENABLED = '1';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.enabled).toBe(true);
    });

    it('returns enabled=false for other NEXT_PUBLIC_WIDGET_ENABLED values', async () => {
      process.env.NEXT_PUBLIC_WIDGET_ENABLED = 'true';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.enabled).toBe(false);
    });

    it('returns default upstreamMode=local when not set', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.upstreamMode).toBe('local');
    });

    it('returns upstreamMode=remote when WIDGET_UPSTREAM_MODE=remote', async () => {
      process.env.WIDGET_UPSTREAM_MODE = 'remote';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.upstreamMode).toBe('remote');
    });

    it('returns defaultWorkspaceId when set', async () => {
      process.env.WIDGET_DEFAULT_WORKSPACE_ID = 'ws_test123';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.defaultWorkspaceId).toBe('ws_test123');
    });

    it('returns null defaultWorkspaceId when not set', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.defaultWorkspaceId).toBeNull();
    });

    it('parses valid corpusScope from comma-separated string', async () => {
      process.env.WIDGET_DEFAULT_CORPUS_SCOPE = 'docs,kb';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.defaultCorpusScope).toEqual(['docs', 'kb']);
    });

    it('filters invalid corpusScope values', async () => {
      process.env.WIDGET_DEFAULT_CORPUS_SCOPE = 'docs,invalid,kb,other';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      // Should only include valid values
      expect(data.defaultCorpusScope).toEqual(['docs', 'kb']);
    });

    it('returns null corpusScope for all invalid values', async () => {
      process.env.WIDGET_DEFAULT_CORPUS_SCOPE = 'invalid,values';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.defaultCorpusScope).toBeNull();
    });

    it('validates minConfidence values', async () => {
      // Valid value
      process.env.WIDGET_DEFAULT_MIN_CONFIDENCE = 'high';
      let response = await GET();
      let data = await parseResponse<WidgetConfigResponse>(response);
      expect(data.defaultMinConfidence).toBe('high');

      // Invalid value
      process.env.WIDGET_DEFAULT_MIN_CONFIDENCE = 'invalid';
      response = await GET();
      data = await parseResponse<WidgetConfigResponse>(response);
      expect(data.defaultMinConfidence).toBeNull();
    });

    it('validates provider values', async () => {
      // Valid values
      const validProviders = ['gemini', 'openai', 'anthropic'];
      for (const provider of validProviders) {
        process.env.WIDGET_DEFAULT_PROVIDER = provider;
        const response = await GET();
        const data = await parseResponse<WidgetConfigResponse>(response);
        expect(data.defaultProvider).toBe(provider);
      }

      // Invalid value
      process.env.WIDGET_DEFAULT_PROVIDER = 'invalid';
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);
      expect(data.defaultProvider).toBeNull();
    });
  });

  describe('Boolean Indicators', () => {
    it('returns verbatimBaseUrlSet=false when not set', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.verbatimBaseUrlSet).toBe(false);
    });

    it('returns verbatimBaseUrlSet=true when set', async () => {
      process.env.VERBATIM_BASE_URL = 'https://example.com';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.verbatimBaseUrlSet).toBe(true);
    });

    it('returns verbatimApiKeySet=false when not set', async () => {
      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.verbatimApiKeySet).toBe(false);
    });

    it('returns verbatimApiKeySet=true when set', async () => {
      process.env.VERBATIM_API_KEY = 'some-key';

      const response = await GET();
      const data = await parseResponse<WidgetConfigResponse>(response);

      expect(data.verbatimApiKeySet).toBe(true);
    });
  });
});
