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

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';

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

export default function PilotSourceDetailPage({
  params,
}: {
  params: { documentId: string };
}) {
  const { documentId } = params;
  const router = useRouter();

  // Active workspace from localStorage
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

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

  // Load workspace from localStorage
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(LS_WORKSPACE_ID);
      if (savedId) setWorkspaceId(savedId);
    } catch {
      // Ignore
    }
  }, []);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/pilot/sources"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/pilot/sources"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">
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
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Sources
          </Link>
        </div>
        <div className="text-gray-500">Document not found.</div>
      </div>
    );
  }

  const displayTitle = document.title || document.canonicalId;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/pilot/sources"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Sources
        </Link>
      </div>

      {/* Header with delete button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                document.corpus === 'docs'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              {document.corpus}
            </span>
            <span className="text-sm text-gray-500">
              {document.workspace.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{displayTitle}</h1>
        </div>

        {/* Delete button / confirmation */}
        <div className="shrink-0">
          {deleteConfirm ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <span className="text-sm text-red-700">Delete this source?</span>
              <button
                onClick={handleDelete}
                disabled={deleting || !canDelete}
                className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
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
              className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Delete source
            </button>
          )}
        </div>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">
            <strong>Delete failed:</strong> {deleteError}
          </p>
        </div>
      )}

      {/* Workspace mismatch warning */}
      {document && workspaceId && document.workspace.id !== workspaceId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            This document belongs to workspace <strong>{document.workspace.name}</strong>,
            but your active workspace is different. Switch to the correct workspace to delete.
          </p>
        </div>
      )}

      {/* No workspace warning */}
      {!workspaceId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            No active workspace selected.{' '}
            <Link href="/pilot/workspaces" className="text-yellow-800 underline">
              Select a workspace
            </Link>{' '}
            to enable delete.
          </p>
        </div>
      )}

      {/* Document metadata */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Document Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Canonical ID</dt>
            <dd className="font-mono text-gray-900 break-all">{document.canonicalId}</dd>
          </div>
          {document.route && (
            <div>
              <dt className="text-gray-500">Route</dt>
              <dd className="font-mono text-gray-900">{document.route}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Source Path</dt>
            <dd className="font-mono text-gray-900 break-all">{document.sourcePath}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Content Hash</dt>
            <dd className="font-mono text-gray-900 text-xs">{document.contentHash}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">
              {new Date(document.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Updated</dt>
            <dd className="text-gray-900">
              {new Date(document.updatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      {/* Chunks */}
      <section className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">
            Chunks ({document.chunkCount})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Expand all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Collapse all
            </button>
          </div>
        </div>

        {document.chunks.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No chunks found.</div>
        ) : (
          <div className="divide-y divide-gray-200">
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
  // Build citation URL for docs corpus
  const citationUrl =
    corpus === 'docs' && route && chunk.anchor
      ? `${route}#${chunk.anchor}`
      : null;

  // Preview of content (first 150 chars)
  const preview =
    chunk.content.length > 150
      ? chunk.content.slice(0, 150) + '...'
      : chunk.content;

  return (
    <div className="px-4 py-3">
      {/* Header row - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left"
      >
        <span className="text-gray-400 mt-0.5">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">
              #{chunk.chunkIndex}
            </span>
            {chunk.headingPath.length > 0 && (
              <span className="text-sm text-gray-700 truncate">
                {chunk.headingPath.join(' > ')}
              </span>
            )}
            {chunk.anchor && (
              <code className="text-xs bg-gray-100 px-1 rounded text-gray-600">
                #{chunk.anchor}
              </code>
            )}
          </div>

          {!expanded && (
            <p className="mt-1 text-sm text-gray-500 truncate">{preview}</p>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 ml-7 space-y-3">
          {/* Citation link */}
          {citationUrl && (
            <div className="text-xs">
              <span className="text-gray-500">Citation URL: </span>
              <code className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">
                {citationUrl}
              </code>
            </div>
          )}

          {/* Content */}
          <div className="bg-gray-50 rounded-lg p-3">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {chunk.content}
            </pre>
          </div>

          {/* Metadata */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span>ID: {chunk.id}</span>
            <span>
              Created: {new Date(chunk.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
