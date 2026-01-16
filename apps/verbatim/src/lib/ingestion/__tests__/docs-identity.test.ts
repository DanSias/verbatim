/**
 * Unit tests for docs identity utilities.
 *
 * Tests route derivation from relative paths.
 * See ARCHITECTURE.md Section 4.3 and Section 6.2.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveRoute,
  buildCanonicalId,
  humanizeFolderName,
  isValidDocsPage,
} from '../docs-identity';

describe('deriveRoute', () => {
  it('derives root route from page.mdx', () => {
    expect(deriveRoute('page.mdx')).toBe('/');
  });

  it('derives route from single-level path', () => {
    expect(deriveRoute('merchant-accounts/page.mdx')).toBe('/merchant-accounts');
  });

  it('derives route from nested path', () => {
    expect(deriveRoute('guides/webhooks/page.mdx')).toBe('/guides/webhooks');
  });

  it('handles deeply nested paths', () => {
    expect(deriveRoute('api/v1/endpoints/page.mdx')).toBe('/api/v1/endpoints');
  });

  it('normalizes Windows-style path separators', () => {
    expect(deriveRoute('merchant-accounts\\page.mdx')).toBe('/merchant-accounts');
    expect(deriveRoute('guides\\webhooks\\page.mdx')).toBe('/guides/webhooks');
  });

  it('handles paths with leading slash', () => {
    expect(deriveRoute('/certification/page.mdx')).toBe('/certification');
  });

  it('ignores the page.mdx filename (uses folder path)', () => {
    // This is critical per ARCHITECTURE.md - identity is route-first, not filename
    expect(deriveRoute('webhooks/page.mdx')).toBe('/webhooks');
    expect(deriveRoute('certification/page.mdx')).toBe('/certification');
  });
});

describe('buildCanonicalId', () => {
  it('builds canonical ID with docs: prefix', () => {
    expect(buildCanonicalId('/')).toBe('docs:/');
    expect(buildCanonicalId('/merchant-accounts')).toBe('docs:/merchant-accounts');
    expect(buildCanonicalId('/guides/webhooks')).toBe('docs:/guides/webhooks');
  });
});

describe('humanizeFolderName', () => {
  it('converts hyphenated names to title case', () => {
    expect(humanizeFolderName('merchant-accounts')).toBe('Merchant Accounts');
  });

  it('converts underscored names to title case', () => {
    expect(humanizeFolderName('getting_started')).toBe('Getting Started');
  });

  it('handles single word names', () => {
    expect(humanizeFolderName('api')).toBe('Api');
    expect(humanizeFolderName('webhooks')).toBe('Webhooks');
  });
});

describe('isValidDocsPage', () => {
  it('returns true for page.mdx at root', () => {
    expect(isValidDocsPage('page.mdx')).toBe(true);
  });

  it('returns true for page.mdx in subdirectory', () => {
    expect(isValidDocsPage('merchant-accounts/page.mdx')).toBe(true);
    expect(isValidDocsPage('guides/webhooks/page.mdx')).toBe(true);
  });

  it('returns false for non-page.mdx files', () => {
    expect(isValidDocsPage('component.mdx')).toBe(false);
    expect(isValidDocsPage('README.md')).toBe(false);
    expect(isValidDocsPage('index.mdx')).toBe(false);
  });

  it('handles case insensitivity', () => {
    expect(isValidDocsPage('PAGE.MDX')).toBe(true);
    expect(isValidDocsPage('Page.Mdx')).toBe(true);
  });
});
