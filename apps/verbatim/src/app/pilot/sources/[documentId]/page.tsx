'use client';

/**
 * Pilot Source Document Detail Page
 *
 * View a single document and all its chunks.
 * Delete the document with confirmation.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActiveWorkspace } from '@/components/workspace-switcher';
import { FileText, Trash2, ChevronDown, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Chunk from API */
interface Chunk {
  id: string;
  content: string;
  headingPath: string[];
  anchor: string | null;
  chunkIndex: number;
  createdAt: string;
}

/** Document from API */
interface Document {
  id: string;
  canonicalId: string;
  corpus: 'docs' | 'kb';
  route: string | null;
  sourcePath: string;
  title: string | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
  };
  chunks: Chunk[];
  chunkCount: number;
}

async function readJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { kind: 'json' as const, data: await res.json() };
  }
  return { kind: 'text' as const, data: await res.text() };
}

/**
 * Strip the first markdown heading line from content for preview.
 * Removes lines matching /^#{1,6}\s+.+$/ and a following blank line if present.
 */
function stripFirstHeading(content: string): string {
  const lines = content.split('\n');

  // Check if first line is a markdown heading
  if (lines.length > 0 && /^#{1,6}\s+.+$/.test(lines[0])) {
    // Remove first line (heading)
    lines.shift();

    // Remove following blank line if present
    if (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }

  return lines.join('\n');
}

/**
 * Truncate ID to show first 6 and last 4 characters
 */
function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

/**
 * Format date as relative time or absolute date
 */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  // Fallback to absolute date
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PilotSourceDetailPage({
  params,
}: {
  params: { documentId: string };
}) {
  const { documentId } = params;
  const router = useRouter();

  // Active workspace from shared hook
  const { activeWorkspace } = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  // Document state
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Expanded chunks
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  // Source details panel state
  const [showSourceDetails, setShowSourceDetails] = useState(false);

  // Copy ID state
  const [copiedId, setCopiedId] = useState(false);

  // Fetch document
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}`, {
        headers: { Accept: 'application/json' },
      });

      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to fetch document'
            : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
        );
        return;
      }

      if (parsed.kind !== 'json') {
        setError(`Expected JSON but got:\n${String(parsed.data).slice(0, 1000)}`);
        return;
      }

      setDocument((parsed.data as { document: Document }).document);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch document');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Delete document
  const handleDelete = useCallback(async () => {
    if (!workspaceId || !document) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(
        `/api/documents/${documentId}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        }
      );

      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setDeleteError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to delete document'
            : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
        );
        setDeleting(false);
        return;
      }

      // Navigate back to sources with success indicator
      router.push('/pilot/sources?deleted=1');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete document');
      setDeleting(false);
    }
  }, [workspaceId, document, documentId, router]);

  // Toggle chunk expansion
  const toggleChunk = (chunkId: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    if (document) {
      setExpandedChunks(new Set(document.chunks.map((c) => c.id)));
    }
  };

  const collapseAll = () => {
    setExpandedChunks(new Set());
  };

  // Check if delete is allowed (workspace must match)
  const canDelete = workspaceId && document && document.workspace.id === workspaceId;

  // Copy document ID to clipboard
  const handleCopyId = useCallback(async () => {
    if (!document) return;

    try {
      await navigator.clipboard.writeText(document.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  }, [document]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/pilot/sources"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/pilot/sources"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/pilot/sources"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="text-gray-500 dark:text-gray-400">Document not found.</div>
      </div>
    );
  }

  const displayTitle = document.title || document.canonicalId;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <div>
        <Link
          href="/pilot/sources"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          &larr; Back to Sources
        </Link>
      </div>

      {/* Header: Badge + Title + Actions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Badge + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
                document.corpus === 'docs'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              }`}
            >
              {document.corpus}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {displayTitle}
            </h1>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSourceDetails(!showSourceDetails)}
              disabled={!document}
              aria-expanded={showSourceDetails}
              aria-controls="source-details-panel"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <FileText className="h-3.5 w-3.5" />
              Source details
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showSourceDetails ? 'rotate-180' : ''}`}
              />
            </button>

            {deleteConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-700 dark:text-red-300">Delete this source?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting || !canDelete}
                  className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                disabled={!canDelete}
                title={
                  !workspaceId
                    ? 'Select an active workspace first'
                    : !canDelete
                      ? 'Document belongs to a different workspace'
                      : 'Delete this source'
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete source
              </button>
            )}
          </div>
        </div>

        {/* Descriptive subhead */}
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
          This source was ingested into the <span className="font-medium text-gray-700 dark:text-gray-300">{document.workspace.name}</span> workspace and split into {document.chunkCount} retrievable {document.chunkCount === 1 ? 'chunk' : 'chunks'}.
        </p>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">
            <strong>Delete failed:</strong> {deleteError}
          </p>
        </div>
      )}

      {/* Workspace mismatch warning */}
      {document && workspaceId && document.workspace.id !== workspaceId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 rounded-lg p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This document belongs to workspace <strong>{document.workspace.name}</strong>,
            but your active workspace is different. Switch to the correct workspace to delete.
          </p>
        </div>
      )}

      {/* No workspace warning */}
      {!workspaceId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 rounded-lg p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            No active workspace selected. Use the workspace switcher in the sidebar to enable delete.
          </p>
        </div>
      )}

      {/* Collapsible Source Details */}
      <div
        id="source-details-panel"
        className="grid transition-all duration-300 ease-in-out"
        style={{
          gridTemplateRows: showSourceDetails ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          <section className="bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Metadata
              </h2>
              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
                title="Copy full document ID"
              >
                {copiedId ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy ID
                  </>
                )}
              </button>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">Canonical ID</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-300 text-right break-all">
                  {document.canonicalId}
                </dd>
              </div>

              {document.route && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400 shrink-0">Route</dt>
                  <dd className="text-right">
                    <a
                      href={document.route}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all"
                    >
                      {document.route}
                    </a>
                  </dd>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">Source Path</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-300 text-right break-all">
                  {document.sourcePath}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">Created</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {formatRelativeDate(document.createdAt)}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">Updated</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {formatRelativeDate(document.updatedAt)}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">Content Hash</dt>
                <dd className="font-mono text-gray-500 dark:text-gray-500 text-right break-all">
                  {document.contentHash.slice(0, 16)}...
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {/* Chunks */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Chunks ({document.chunkCount})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Expand all
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Collapse all
            </button>
          </div>
        </div>

        {document.chunks.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No chunks found.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {document.chunks.map((chunk) => (
              <ChunkRow
                key={chunk.id}
                chunk={chunk}
                corpus={document.corpus}
                route={document.route}
                expanded={expandedChunks.has(chunk.id)}
                onToggle={() => toggleChunk(chunk.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Chunk row component */
function ChunkRow({
  chunk,
  corpus,
  route,
  expanded,
  onToggle,
}: {
  chunk: Chunk;
  corpus: 'docs' | 'kb';
  route: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copiedChunkId, setCopiedChunkId] = useState(false);

  // Build citation URL for docs corpus
  const citationUrl =
    corpus === 'docs' && route && chunk.anchor
      ? `${route}#${chunk.anchor}`
      : null;

  // Preview of content (first 150 chars) - strip heading first
  const contentWithoutHeading = stripFirstHeading(chunk.content);
  const preview =
    contentWithoutHeading.length > 150
      ? contentWithoutHeading.slice(0, 150) + '...'
      : contentWithoutHeading;

  // Copy chunk ID to clipboard
  const handleCopyChunkId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(chunk.id);
      setCopiedChunkId(true);
      setTimeout(() => setCopiedChunkId(false), 2000);
    } catch (err) {
      console.error('Failed to copy chunk ID:', err);
    }
  };

  return (
    <div className="px-4 py-3 group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
      {/* Header row - clickable */}
      <button
        onClick={onToggle}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 rounded -mx-1 px-1"
      >
        <div className="flex items-start gap-3">
          <span className="text-gray-400 dark:text-gray-500 mt-0.5 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>

          <div className="flex-1 min-w-0">
            {/* First line: chunk number + heading path + anchor */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                  #{chunk.chunkIndex}
                </span>
                {chunk.headingPath.length > 0 && (
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {chunk.headingPath.join(' › ')}
                  </span>
                )}
              </div>

              {/* Right-aligned anchor chip */}
              {chunk.anchor && (
                <code className="shrink-0 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                  #{chunk.anchor}
                </code>
              )}
            </div>

            {/* Second line: preview text (only when collapsed) */}
            {!expanded && preview && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {preview}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 ml-7 space-y-3">
          {/* Citation URL with metadata on right */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs">
              {citationUrl ? (
                <>
                  <span className="text-gray-500 dark:text-gray-400">Citation URL: </span>
                  <a
                    href={citationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                  >
                    {citationUrl}
                  </a>
                </>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">Knowledge base chunk</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Created {formatRelativeDate(chunk.createdAt)}
              </span>
              <button
                onClick={handleCopyChunkId}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
                title="Copy chunk ID"
                aria-label="Copy chunk ID"
              >
                {copiedChunkId ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span className="sr-only">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="sr-only">Copy ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Content - rendered as Markdown */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-gray-800 dark:text-gray-200 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 dark:[&_h1]:text-gray-100 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 dark:[&_h3]:text-gray-100 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-gray-900 dark:[&_h4]:text-gray-100 [&_h4]:mt-2 [&_h4]:mb-1 [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:leading-relaxed [&_p]:my-2 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:font-medium [&_a]:no-underline hover:[&_a]:underline [&_code]:text-gray-800 dark:[&_code]:text-gray-200 [&_code]:bg-gray-100 dark:[&_code]:bg-gray-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:before:content-none [&_code]:after:content-none [&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-200 dark:[&_pre]:border-gray-700 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-800 dark:[&_pre_code]:text-gray-200 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:text-gray-700 dark:[&_li]:text-gray-300 [&_li]:my-1 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_strong]:font-semibold [&_em]:italic [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 dark:[&_blockquote]:text-gray-400 [&_table]:border-collapse [&_table]:w-full [&_table]:my-3 [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-gray-600 [&_th]:p-2 [&_th]:bg-gray-100 dark:[&_th]:bg-gray-700 [&_th]:font-semibold [&_th]:text-gray-900 dark:[&_th]:text-gray-100 [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-gray-600 [&_td]:p-2 [&_td]:text-gray-700 dark:[&_td]:text-gray-300 [&_hr]:border-gray-300 dark:[&_hr]:border-gray-600 [&_hr]:my-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {chunk.content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
