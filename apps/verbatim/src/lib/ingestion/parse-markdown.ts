/**
 * Markdown Parsing Utilities (KB Corpus)
 *
 * Parses standard Markdown content for KB articles.
 * See ARCHITECTURE.md Section 6.3 and 8.6.
 *
 * Unlike MDX parsing, this does NOT handle JSX components.
 * Preserves headings and code blocks.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import matter from 'gray-matter';
import type { Root, Content, Heading, Code } from 'mdast';

export interface ParsedMarkdown {
  /** Frontmatter data (title, etc.) */
  frontmatter: Record<string, unknown>;
  /** The mdast AST root */
  ast: Root;
  /** Normalized text content */
  normalizedContent: string;
  /** First H1 heading text, if present */
  firstH1: string | null;
}

/**
 * Parse Markdown content into an AST and extract metadata.
 * Used for KB corpus articles.
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  // Extract frontmatter (KB articles may have YAML frontmatter)
  const { data: frontmatter, content: mdContent } = matter(content);

  // Parse Markdown to AST (no MDX extensions needed)
  const ast = fromMarkdown(mdContent);

  // Find first H1
  const firstH1 = findFirstH1(ast);

  // Normalize content
  const normalizedContent = normalizeAst(ast);

  return {
    frontmatter,
    ast,
    normalizedContent,
    firstH1,
  };
}

/**
 * Find the first H1 heading in the AST.
 */
function findFirstH1(ast: Root): string | null {
  for (const node of ast.children) {
    if (node.type === 'heading' && node.depth === 1) {
      return toString(node);
    }
  }
  return null;
}

/**
 * Normalize AST to text, preserving structure.
 * Keeps headings and code blocks.
 */
function normalizeAst(ast: Root): string {
  const lines: string[] = [];

  for (const node of ast.children) {
    const text = normalizeNode(node);
    if (text) {
      lines.push(text);
    }
  }

  return lines.join('\n\n');
}

/**
 * Normalize a single AST node to text.
 */
function normalizeNode(node: Content): string {
  switch (node.type) {
    case 'heading':
      return normalizeHeading(node as Heading);

    case 'code':
      return normalizeCode(node as Code);

    case 'paragraph':
    case 'blockquote':
    case 'list':
    case 'listItem':
    case 'table':
    case 'tableRow':
    case 'tableCell':
    case 'definition':
    case 'footnoteDefinition':
      return toString(node);

    case 'thematicBreak':
      return '---';

    default:
      return toString(node);
  }
}

/**
 * Normalize a heading node, preserving the heading level markers.
 */
function normalizeHeading(node: Heading): string {
  const prefix = '#'.repeat(node.depth);
  const text = toString(node);
  return `${prefix} ${text}`;
}

/**
 * Normalize a code block, preserving the fence and language.
 */
function normalizeCode(node: Code): string {
  const lang = node.lang || '';
  return `\`\`\`${lang}\n${node.value}\n\`\`\``;
}

/**
 * Extract the title from parsed Markdown.
 * Returns frontmatter title or first H1, or null.
 */
export function extractMarkdownTitle(parsed: ParsedMarkdown): string | null {
  // Priority 1: frontmatter title
  if (typeof parsed.frontmatter.title === 'string') {
    return parsed.frontmatter.title;
  }

  // Priority 2: first H1
  if (parsed.firstH1) {
    return parsed.firstH1;
  }

  return null;
}
