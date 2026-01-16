/**
 * Unit tests for H2-based chunking.
 *
 * Tests corpus-aware chunking behavior.
 * See ARCHITECTURE.md Section 8.
 *
 * Key invariants:
 * - Chunk boundary = H2 (##)
 * - H1 is page-level context (not a chunk boundary)
 * - H3+ remain inside the H2 chunk
 * - Docs: anchors are computed for linkable citations
 * - KB: anchors are null (no navigation links)
 */

import { describe, it, expect } from 'vitest';
import { chunkDocsContent, chunkKbContent, buildCitationUrl } from '../chunking';

describe('chunkDocsContent', () => {
  it('creates one chunk per H2 section', () => {
    const content = `# Page Title

Introduction paragraph.

## Setup

Setup content here.

## Configuration

Configuration content here.

## Limits

Limits content here.`;

    const chunks = chunkDocsContent(content, 'Page Title');

    // Should have 4 chunks: preamble + 3 H2 sections
    expect(chunks).toHaveLength(4);
  });

  it('includes H3 content within the same H2 chunk', () => {
    const content = `## Main Section

Intro text.

### Subsection A

Subsection A content.

### Subsection B

Subsection B content.`;

    const chunks = chunkDocsContent(content, null);

    // Should be 1 chunk - H3s don't split chunks
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('### Subsection A');
    expect(chunks[0].content).toContain('### Subsection B');
  });

  it('sets correct headingPath with H1 and H2', () => {
    const content = `## Setup

Setup content.`;

    const chunks = chunkDocsContent(content, 'Getting Started');

    expect(chunks[0].headingPath).toEqual(['Getting Started', 'Setup']);
  });

  it('sets headingPath without H1 when not provided', () => {
    const content = `## Configuration

Config content.`;

    const chunks = chunkDocsContent(content, null);

    expect(chunks[0].headingPath).toEqual(['Configuration']);
  });

  it('generates correct anchors for H2 headings', () => {
    const content = `## Merchant Account Setup

Content here.

## Webhook Configuration

More content.`;

    const chunks = chunkDocsContent(content, null);

    expect(chunks[0].anchor).toBe('merchant-account-setup');
    expect(chunks[1].anchor).toBe('webhook-configuration');
  });

  it('sets anchor to null for preamble (content before first H2)', () => {
    const content = `This is preamble content before any H2.

Some more intro.

## First Section

Section content.`;

    const chunks = chunkDocsContent(content, null);

    // First chunk is preamble - no anchor
    expect(chunks[0].anchor).toBeNull();
    expect(chunks[0].content).toContain('preamble content');

    // Second chunk has anchor
    expect(chunks[1].anchor).toBe('first-section');
  });

  it('handles document with no H2 headings', () => {
    const content = `# Just a Title

Some content without any H2 sections.

Just paragraphs here.`;

    const chunks = chunkDocsContent(content, 'Just a Title');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].anchor).toBeNull();
  });

  it('sets sequential chunkIndex values', () => {
    const content = `## One

Content.

## Two

Content.

## Three

Content.`;

    const chunks = chunkDocsContent(content, null);

    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[2].chunkIndex).toBe(2);
  });
});

describe('chunkKbContent', () => {
  it('always sets anchor to null for KB content', () => {
    const content = `## Troubleshooting

Some troubleshooting steps.

## Common Issues

List of common issues.`;

    const chunks = chunkKbContent(content, null);

    // KB chunks should never have anchors (per ARCHITECTURE.md Section 7.2)
    expect(chunks[0].anchor).toBeNull();
    expect(chunks[1].anchor).toBeNull();
  });

  it('still splits by H2 for KB content', () => {
    const content = `## Section A

Content A.

## Section B

Content B.`;

    const chunks = chunkKbContent(content, null);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toEqual(['Section A']);
    expect(chunks[1].headingPath).toEqual(['Section B']);
  });
});

describe('buildCitationUrl', () => {
  it('builds URL with route and anchor', () => {
    expect(buildCitationUrl('/merchant-accounts', 'setup')).toBe(
      '/merchant-accounts#setup'
    );
  });

  it('returns just route when anchor is null', () => {
    expect(buildCitationUrl('/merchant-accounts', null)).toBe('/merchant-accounts');
  });

  it('handles root route', () => {
    expect(buildCitationUrl('/', 'overview')).toBe('/#overview');
    expect(buildCitationUrl('/', null)).toBe('/');
  });
});
