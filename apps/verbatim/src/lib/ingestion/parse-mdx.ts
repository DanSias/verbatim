/**
 * MDX Parsing Utilities
 *
 * Converts MDX content to normalized text suitable for chunking.
 * See ARCHITECTURE.md Section 8.6:
 * - Strip MDX components
 * - Preserve headings and code blocks
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { toString } from 'mdast-util-to-string';
import { mdxjs } from 'micromark-extension-mdxjs';
import matter from 'gray-matter';
import type { Root, Content, Heading, Code } from 'mdast';

export interface ParsedMdx {
  /** Frontmatter data (title, etc.) */
  frontmatter: Record<string, unknown>;
  /** The mdast AST root */
  ast: Root;
  /** Normalized text content (MDX components stripped) */
  normalizedContent: string;
  /** First H1 heading text, if present */
  firstH1: string | null;
}

/**
 * Parse MDX content into an AST and extract metadata.
 */
export function parseMdx(content: string): ParsedMdx {
  // Extract frontmatter
  const { data: frontmatter, content: mdxContent } = matter(content);

  // Parse MDX to AST
  const ast = fromMarkdown(mdxContent, {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()],
  });

  // Find first H1
  const firstH1 = findFirstH1(ast);

  // Normalize content (strip MDX components, preserve structure)
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
 * Normalize AST to text, stripping MDX components but preserving structure.
 * Keeps headings and code blocks as specified in ARCHITECTURE.md Section 8.6.
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

    // MDX-specific nodes - strip these
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
    case 'mdxjsEsm':
      // Strip MDX components entirely
      return '';

    default:
      // For any other node types, try to extract text
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
 * Extract the title from parsed MDX using the priority order from ARCHITECTURE.md Section 6.2:
 * 1. frontmatter title
 * 2. first H1
 * 3. null (caller should fall back to folder name)
 */
export function extractTitle(parsed: ParsedMdx): string | null {
  // Priority 1: frontmatter title
  if (typeof parsed.frontmatter.title === 'string') {
    return parsed.frontmatter.title;
  }

  // Priority 2: first H1
  if (parsed.firstH1) {
    return parsed.firstH1;
  }

  // Priority 3: null (caller handles fallback)
  return null;
}
