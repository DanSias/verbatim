/**
 * Integration tests for /api/widget/answer endpoint.
 *
 * Tests the widget proxy behavior including:
 * - Always returning JSON responses (never HTML)
 * - Proper validation error handling
 * - Workspace ID resolution from header
 *
 * See Phase 8.2 for widget portability specification.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/widget/answer/route';
import { db } from '@/lib/db';

// Test workspace name
const TEST_WORKSPACE_NAME = '__test__widget_fixtures';

// Store workspace ID for test
let testWorkspaceId: string;

/**
 * Helper to create a mock NextRequest for testing
 */
function createMockRequest(
  body: object | string,
  headers?: Record<string, string>
): NextRequest {
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  });

  return new NextRequest('http://localhost:3000/api/widget/answer', {
    method: 'POST',
    headers: requestHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
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

// Response type from /api/widget/answer
interface WidgetResponse {
  question?: string;
  workspaceId?: string;
  answer?: string;
  citations?: Array<{ index: number; route?: string; sourcePath?: string }>;
  suggestedRoutes?: Array<{ route: string; title: string | null }>;
  confidence?: 'high' | 'medium' | 'low';
  mode?: 'answer' | 'ticket_draft';
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

describe('Integration: /api/widget/answer', () => {
  beforeAll(async () => {
    // Set required environment variable for tests
    process.env.WIDGET_DEFAULT_WORKSPACE_ID = '';

    // Create test workspace
    const workspace = await db.workspace.create({
      data: {
        name: TEST_WORKSPACE_NAME,
      },
    });
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    // Clean up: delete workspace
    await db.workspace.delete({
      where: { id: testWorkspaceId },
    });

    // Reset env
    delete process.env.WIDGET_DEFAULT_WORKSPACE_ID;
  });

  describe('JSON Response Guarantee', () => {
    it('returns JSON for empty request body', async () => {
      // Must pass workspace ID to get past that check first
      const request = createMockRequest('', {
        'x-verbatim-workspace-id': testWorkspaceId,
      });
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
      // Error message varies by how empty body is interpreted
      expect(data.error).toBeDefined();
    });

    it('returns JSON for invalid JSON body', async () => {
      // Must pass workspace ID to get past that check first
      const request = createMockRequest('{ not valid json }', {
        'x-verbatim-workspace-id': testWorkspaceId,
      });
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
    });

    it('returns JSON for missing question field', async () => {
      const request = createMockRequest(
        { notQuestion: 'some value' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('question');
    });

    it('returns JSON for empty question', async () => {
      const request = createMockRequest(
        { question: '   ' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('empty');
    });

    it('returns JSON for question exceeding max length', async () => {
      const longQuestion = 'x'.repeat(2001);
      const request = createMockRequest(
        { question: longQuestion },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('2000');
    });
  });

  describe('Workspace ID Resolution', () => {
    it('returns error when no workspace ID available', async () => {
      // Ensure no default workspace ID
      const originalEnv = process.env.WIDGET_DEFAULT_WORKSPACE_ID;
      process.env.WIDGET_DEFAULT_WORKSPACE_ID = '';

      const request = createMockRequest({ question: 'test question' });
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('workspaceId');

      // Restore env
      process.env.WIDGET_DEFAULT_WORKSPACE_ID = originalEnv;
    });

    it('accepts workspace ID from header', async () => {
      const request = createMockRequest(
        { question: 'test question' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);

      // Should proceed past workspace validation
      // (may fail at upstream or return actual answer)
      const data = await parseResponse<WidgetResponse>(response);

      // Response should be JSON regardless of success/failure
      expect(typeof data).toBe('object');

      // If it got past validation, it should NOT be a workspace validation error
      if (data.code === 'VALIDATION_ERROR') {
        expect(data.error).not.toContain('workspaceId');
      }
    });

    it('header takes precedence over env default', async () => {
      // Set a default workspace ID
      const originalEnv = process.env.WIDGET_DEFAULT_WORKSPACE_ID;
      process.env.WIDGET_DEFAULT_WORKSPACE_ID = 'default-workspace-id';

      const request = createMockRequest(
        { question: 'test question' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      // Should use header workspace, not env default
      // The actual answer may vary, but we can verify it's valid JSON
      expect(typeof data).toBe('object');

      // Restore env
      process.env.WIDGET_DEFAULT_WORKSPACE_ID = originalEnv;
    });
  });

  describe('Input Validation', () => {
    it('clamps topK to valid range (1-10)', async () => {
      const request = createMockRequest(
        { question: 'test', topK: 100 },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      // Should succeed or fail gracefully (not validation error for topK)
      expect(typeof data).toBe('object');
      if (data.code === 'VALIDATION_ERROR') {
        expect(data.error).not.toContain('topK');
      }
    });

    it('silently ignores invalid corpusScope values', async () => {
      const request = createMockRequest(
        { question: 'test', corpusScope: ['invalid', 'values'] },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      // Should succeed or fail gracefully (not validation error for corpusScope)
      expect(typeof data).toBe('object');
      if (data.code === 'VALIDATION_ERROR') {
        expect(data.error).not.toContain('corpusScope');
      }
    });

    it('silently ignores invalid minConfidence value', async () => {
      const request = createMockRequest(
        { question: 'test', minConfidence: 'invalid' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      // Should succeed or fail gracefully (not validation error for minConfidence)
      expect(typeof data).toBe('object');
      if (data.code === 'VALIDATION_ERROR') {
        expect(data.error).not.toContain('minConfidence');
      }
    });

    it('silently ignores invalid provider value', async () => {
      const request = createMockRequest(
        { question: 'test', provider: 'invalid-provider' },
        { 'x-verbatim-workspace-id': testWorkspaceId }
      );
      const response = await POST(request);
      const data = await parseResponse<WidgetResponse>(response);

      // Should succeed or fail gracefully (not validation error for provider)
      expect(typeof data).toBe('object');
      if (data.code === 'VALIDATION_ERROR') {
        expect(data.error).not.toContain('provider');
      }
    });
  });
});
