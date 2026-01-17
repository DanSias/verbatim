/**
 * Ticket Draft Generation
 *
 * Generates structured ticket drafts for support escalation.
 * Used when confidence is low or explicitly requested.
 *
 * Ticket drafts are generated deterministically from retrieval results,
 * with optional LLM enhancement for summarization.
 */

import type { RetrievedChunk } from '@/lib/retrieval';
import type { TicketDraft, AnswerCitation } from './types';

/** Options for ticket draft generation */
export interface TicketDraftOptions {
  /** User's original question */
  question: string;
  /** Retrieved chunks */
  chunks: RetrievedChunk[];
  /** Answer if one was generated */
  answer?: string;
  /** Citations from the answer */
  citations: AnswerCitation[];
}

/**
 * Generate a ticket draft from retrieval results.
 *
 * This is a deterministic fallback that doesn't require LLM.
 * Can be enhanced with LLM summarization later.
 *
 * @param options - Draft generation options
 * @returns Ticket draft
 */
export function generateTicketDraft(options: TicketDraftOptions): TicketDraft {
  const { question, chunks, answer, citations } = options;

  // Generate title (max 80 chars)
  const title = generateTitle(question);

  // Generate summary bullets
  const summary = generateSummary(question, chunks, answer);

  // Generate suggested next info
  const suggestedNextInfo = generateSuggestedNextInfo(question, chunks);

  // Ensure we have citations (fallback to top chunks if none parsed)
  const finalCitations =
    citations.length > 0 ? citations : generateFallbackCitations(chunks);

  return {
    title,
    summary,
    userQuestion: question,
    attemptedAnswer: answer,
    suggestedNextInfo,
    citations: finalCitations,
  };
}

/**
 * Generate a short title from the question.
 */
function generateTitle(question: string): string {
  // Clean up the question
  let title = question.trim();

  // Remove question marks and trailing punctuation
  title = title.replace(/[?!.]+$/, '');

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate to 80 chars
  if (title.length > 77) {
    title = title.slice(0, 77) + '...';
  }

  return title;
}

/**
 * Generate summary bullets.
 */
function generateSummary(
  question: string,
  chunks: RetrievedChunk[],
  answer?: string
): string[] {
  const summary: string[] = [];

  // Add question context
  summary.push(`User asked: "${truncate(question, 100)}"`);

  // Add info about what was found
  if (chunks.length === 0) {
    summary.push('No relevant documentation was found for this query.');
  } else {
    const docsCount = chunks.filter((c) => c.corpus === 'docs').length;
    const kbCount = chunks.filter((c) => c.corpus === 'kb').length;

    if (docsCount > 0 && kbCount > 0) {
      summary.push(
        `Found ${docsCount} docs section(s) and ${kbCount} KB article(s) that may be related.`
      );
    } else if (docsCount > 0) {
      summary.push(`Found ${docsCount} docs section(s) that may be related.`);
    } else if (kbCount > 0) {
      summary.push(`Found ${kbCount} KB article(s) that may be related.`);
    }
  }

  // Add note about attempted answer
  if (answer) {
    const answerPreview = truncate(answer, 150);
    summary.push(`Automated response attempted: "${answerPreview}"`);
  } else {
    summary.push('No automated response was generated due to low confidence.');
  }

  // Add note about confidence
  summary.push(
    'This ticket was created because the system could not confidently answer the question.'
  );

  return summary;
}

/**
 * Generate suggested next info bullets.
 */
function generateSuggestedNextInfo(
  question: string,
  chunks: RetrievedChunk[]
): string[] {
  const suggestions: string[] = [];

  // Generic suggestions based on question content
  const questionLower = question.toLowerCase();

  if (
    questionLower.includes('error') ||
    questionLower.includes('fail') ||
    questionLower.includes('not working')
  ) {
    suggestions.push('Ask for specific error messages or codes');
    suggestions.push('Request steps to reproduce the issue');
  }

  if (
    questionLower.includes('setup') ||
    questionLower.includes('configure') ||
    questionLower.includes('integration')
  ) {
    suggestions.push('Confirm environment (sandbox vs production)');
    suggestions.push('Request API version and SDK details if applicable');
  }

  if (questionLower.includes('payment') || questionLower.includes('transaction')) {
    suggestions.push('Ask for transaction ID or reference number');
    suggestions.push('Confirm merchant account status');
  }

  // Add suggestions based on found content
  if (chunks.length > 0) {
    const topChunk = chunks[0];
    if (topChunk.corpus === 'docs' && topChunk.route) {
      suggestions.push(`Review related documentation at ${topChunk.route}`);
    }
    if (topChunk.corpus === 'kb') {
      suggestions.push(`Check KB article: ${topChunk.title || topChunk.sourcePath}`);
    }
  }

  // Fallback suggestions
  if (suggestions.length < 3) {
    suggestions.push('Gather more context about the specific use case');
    suggestions.push('Verify account and workspace settings');
    suggestions.push('Check for any recent configuration changes');
  }

  // Return top 5
  return suggestions.slice(0, 5);
}

/**
 * Generate fallback citations from top chunks.
 */
function generateFallbackCitations(chunks: RetrievedChunk[]): AnswerCitation[] {
  return chunks.slice(0, 3).map((chunk, i) => {
    const index = i + 1;

    if (chunk.corpus === 'docs') {
      const route = chunk.route || '/';
      const anchor = chunk.anchor;
      const url = anchor ? `${route}#${anchor}` : route;

      return {
        index,
        corpus: 'docs' as const,
        route,
        anchor,
        url,
      };
    }

    return {
      index,
      corpus: 'kb' as const,
      sourcePath: chunk.sourcePath,
    };
  });
}

/**
 * Truncate text to max length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format ticket draft as plain text for copying.
 */
export function formatTicketDraftAsText(draft: TicketDraft): string {
  const lines: string[] = [];

  lines.push(`Title: ${draft.title}`);
  lines.push('');
  lines.push('Summary:');
  draft.summary.forEach((point) => {
    lines.push(`  - ${point}`);
  });
  lines.push('');
  lines.push(`Original Question: ${draft.userQuestion}`);

  if (draft.attemptedAnswer) {
    lines.push('');
    lines.push('Attempted Answer:');
    lines.push(draft.attemptedAnswer);
  }

  lines.push('');
  lines.push('Suggested Next Steps:');
  draft.suggestedNextInfo.forEach((point) => {
    lines.push(`  - ${point}`);
  });

  if (draft.citations.length > 0) {
    lines.push('');
    lines.push('Related Documentation:');
    draft.citations.forEach((citation) => {
      if (citation.corpus === 'docs') {
        lines.push(`  [${citation.index}] ${citation.url}`);
      } else {
        lines.push(`  [${citation.index}] KB: ${citation.sourcePath}`);
      }
    });
  }

  return lines.join('\n');
}
