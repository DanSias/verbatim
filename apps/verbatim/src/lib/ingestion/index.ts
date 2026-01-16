/**
 * Ingestion utilities for Verbatim.
 *
 * See ARCHITECTURE.md for specifications.
 *
 * Docs corpus: MDX parsing, route-first identity, anchored chunks
 * KB corpus: Markdown parsing, path-first identity, no anchors
 */

// Docs corpus utilities
export * from './parse-mdx';
export * from './docs-identity';

// KB corpus utilities
export * from './parse-markdown';
export * from './kb-identity';

// Shared utilities
export * from './chunking';
export * from './hash';
