/**
 * Integration tests for /api/ask endpoint.
 *
 * Tests the full retrieval pipeline end-to-end using fixture data.
 * Validates ranking, citations, and suggested routes behavior.
 *
 * See ARCHITECTURE.md Section 11.3 for /api/ask specification.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ask/route';
import { db } from '@/lib/db';
import {
  // Docs corpus
  parseMdx,
  extractTitle,
  deriveRoute,
  buildCanonicalId,
  deriveTitle,
  chunkDocsContent,
  // KB corpus
  parseMarkdown,
  extractMarkdownTitle,
  buildKbCanonicalId,
  deriveKbTitle,
  chunkKbContent,
  // Shared
  computeContentHash,
  DEFAULT_CHUNKING_CONFIG,
} from '@/lib/ingestion';
import type { SearchResult, DocsCitation, KbCitation } from '@/lib/retrieval';
import * as fs from 'fs';
import * as path from 'path';

// Test workspace name
const TEST_WORKSPACE_NAME = '__test__fixtures';

// Store workspace ID for test cleanup
let testWorkspaceId: string;

// Fixture paths (relative to repo root)
const FIXTURES_ROOT = path.resolve(__dirname, '../../../../fixtures');
const DOCS_FIXTURES = path.join(FIXTURES_ROOT, 'docs');
const KB_FIXTURES = path.join(FIXTURES_ROOT, 'kb');

/**
 * Helper to create a mock NextRequest for testing
 */
function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper to parse response JSON
 */
async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Ingest a docs file directly using the ingestion utilities
 */
async function ingestDocsFile(
  workspaceId: string,
  relativePath: string,
  content: string
): Promise<void> {
  const contentHash = computeContentHash(content);
  const route = deriveRoute(relativePath);
  const canonicalId = buildCanonicalId(route);

  const parsed = parseMdx(content);
  const frontmatterTitle = extractTitle(parsed);
  const title = deriveTitle(frontmatterTitle, parsed.firstH1, route);
  const chunks = chunkDocsContent(
    parsed.normalizedContent,
    parsed.firstH1,
    DEFAULT_CHUNKING_CONFIG
  );

  await db.document.create({
    data: {
      workspaceId,
      canonicalId,
      corpus: 'docs',
      route,
      sourcePath: relativePath,
      title,
      contentHash,
      chunks: {
        create: chunks.map((chunk) => ({
          content: chunk.content,
          headingPath: chunk.headingPath,
          anchor: chunk.anchor,
          chunkIndex: chunk.chunkIndex,
        })),
      },
    },
  });
}

/**
 * Ingest a KB file directly using the ingestion utilities
 */
async function ingestKbFile(
  workspaceId: string,
  filename: string,
  content: string
): Promise<void> {
  const contentHash = computeContentHash(content);
  const canonicalId = buildKbCanonicalId(filename);

  const parsed = parseMarkdown(content);
  const frontmatterTitle = extractMarkdownTitle(parsed);
  const title = deriveKbTitle(frontmatterTitle, parsed.firstH1, filename);
  const chunks = chunkKbContent(
    parsed.normalizedContent,
    parsed.firstH1,
    DEFAULT_CHUNKING_CONFIG
  );

  await db.document.create({
    data: {
      workspaceId,
      canonicalId,
      corpus: 'kb',
      route: null, // KB has no routes
      sourcePath: filename,
      title,
      contentHash,
      chunks: {
        create: chunks.map((chunk) => ({
          content: chunk.content,
          headingPath: chunk.headingPath,
          anchor: chunk.anchor, // null for KB
          chunkIndex: chunk.chunkIndex,
        })),
      },
    },
  });
}

/**
 * Read and ingest all docs fixtures
 */
async function ingestDocsFixtures(workspaceId: string): Promise<void> {
  // Root page.mdx
  const rootContent = fs.readFileSync(
    path.join(DOCS_FIXTURES, 'page.mdx'),
    'utf-8'
  );
  await ingestDocsFile(workspaceId, 'page.mdx', rootContent);

  // Nested pages
  const docsSubdirs = ['merchant-accounts', 'webhooks'];
  for (const subdir of docsSubdirs) {
    const filePath = path.join(DOCS_FIXTURES, subdir, 'page.mdx');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      await ingestDocsFile(workspaceId, `${subdir}/page.mdx`, content);
    }
  }
}

/**
 * Read and ingest all KB fixtures
 */
async function ingestKbFixtures(workspaceId: string): Promise<void> {
  const kbFiles = fs.readdirSync(KB_FIXTURES).filter((f) => f.endsWith('.md'));
  for (const filename of kbFiles) {
    const content = fs.readFileSync(path.join(KB_FIXTURES, filename), 'utf-8');
    await ingestKbFile(workspaceId, filename, content);
  }
}

// Response type from /api/ask
interface AskResponse {
  question: string;
  workspaceId: string;
  conversationId: string;
  results: SearchResult[];
  suggestedRoutes: Array<{ route: string; title: string | null }>;
  debug: {
    retrievalMode: string;
    totalChunksScanned: number;
    topK: number;
    corpusScope: string[];
  };
}

describe('Integration: /api/ask', () => {
  beforeAll(async () => {
    // Create test workspace
    const workspace = await db.workspace.create({
      data: {
        name: TEST_WORKSPACE_NAME,
      },
    });
    testWorkspaceId = workspace.id;

    // Ingest fixtures
    await ingestDocsFixtures(testWorkspaceId);
    await ingestKbFixtures(testWorkspaceId);
  });

  afterAll(async () => {
    // Clean up: delete workspace and cascade documents/chunks
    await db.workspace.delete({
      where: { id: testWorkspaceId },
    });
  });

  it('ranks docs higher for "merchant account setup" query', async () => {
    // This query matches docs /merchant-accounts title and content
    const request = createMockRequest({
      workspaceId: testWorkspaceId,
      question: 'merchant account setup',
    });

    const response = await POST(request);
    const data = await parseResponse<AskResponse>(response);

    expect(response.status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);

    // First result should be from docs corpus (has specific API content)
    const topResult = data.results[0];
    expect(topResult.corpus).toBe('docs');

    // Citation should be a docs citation with route
    const citation = topResult.citation as DocsCitation;
    expect(citation.route).toBeDefined();
    expect(citation.route).toBe('/merchant-accounts');
  });

  it('returns cross-corpus results for "webhook configuration"', async () => {
    // "webhook configuration" appears in both docs and KB
    const request = createMockRequest({
      workspaceId: testWorkspaceId,
      question: 'webhook configuration',
    });

    const response = await POST(request);
    const data = await parseResponse<AskResponse>(response);

    expect(response.status).toBe(200);
    expect(data.results.length).toBeGreaterThan(1);

    // Should have results from both corpora
    const corpora = new Set(data.results.map((r) => r.corpus));
    expect(corpora.has('docs')).toBe(true);
    expect(corpora.has('kb')).toBe(true);
  });

  it('ranks KB higher for "signature verification failing"', async () => {
    // This is a specific H2 heading in webhooks-troubleshooting.md
    const request = createMockRequest({
      workspaceId: testWorkspaceId,
      question: 'signature verification failing',
    });

    const response = await POST(request);
    const data = await parseResponse<AskResponse>(response);

    expect(response.status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);

    // Top result should be from KB (exact heading match)
    const topResult = data.results[0];
    expect(topResult.corpus).toBe('kb');

    // KB citation should have sourcePath, not route
    const citation = topResult.citation as KbCitation;
    expect(citation.sourcePath).toBe('webhooks-troubleshooting.md');
  });

  it('returns multiple docs results for "limits" query', async () => {
    // "Limits" is an H2 heading in both / (Getting Started) and /merchant-accounts
    const request = createMockRequest({
      workspaceId: testWorkspaceId,
      question: 'limits',
    });

    const response = await POST(request);
    const data = await parseResponse<AskResponse>(response);

    expect(response.status).toBe(200);

    // Filter to docs results only
    const docsResults = data.results.filter((r) => r.corpus === 'docs');
    expect(docsResults.length).toBeGreaterThanOrEqual(2);

    // Should have results from multiple docs routes
    const routes = new Set(
      docsResults.map((r) => (r.citation as DocsCitation).route)
    );
    expect(routes.size).toBeGreaterThanOrEqual(2);
  });

  it('suggestedRoutes contains only docs routes, never KB paths', async () => {
    // Query that would return both docs and KB results
    const request = createMockRequest({
      workspaceId: testWorkspaceId,
      question: 'webhook',
    });

    const response = await POST(request);
    const data = await parseResponse<AskResponse>(response);

    expect(response.status).toBe(200);

    // All suggested routes should be valid docs routes (start with /)
    for (const suggested of data.suggestedRoutes) {
      expect(suggested.route).toMatch(/^\//);
      // Should NOT contain .md extension (KB paths)
      expect(suggested.route).not.toMatch(/\.md$/);
    }

    // Verify KB results exist but are not in suggestedRoutes
    const kbResults = data.results.filter((r) => r.corpus === 'kb');
    if (kbResults.length > 0) {
      const suggestedRouteSet = new Set(
        data.suggestedRoutes.map((s) => s.route)
      );
      // KB citations use sourcePath, not route
      for (const kbResult of kbResults) {
        const kbCitation = kbResult.citation as KbCitation;
        expect(suggestedRouteSet.has(kbCitation.sourcePath)).toBe(false);
      }
    }
  });
});
