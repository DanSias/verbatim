'use client';

/**
 * Pilot Sources Page
 *
 * View all documents ingested into the active workspace.
 * Filter by corpus (All, Docs, KB) and search by title/canonicalId.
 * Delete individual documents with confirmation.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';

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
  chunkCount: number;
}

type CorpusFilter = 'all' | 'docs' | 'kb';

async function readJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { kind: 'json' as const, data: await res.json() };
  }
  return { kind: 'text' as const, data: await res.text() };
}

export default function PilotSourcesPage() {
  const searchParams = useSearchParams();

  // Active workspace from localStorage
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [corpusFilter, setCorpusFilter] = useState<CorpusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check for ?deleted=1 query param (redirected from detail page after delete)
  useEffect(() => {
    if (searchParams.get('deleted') === '1') {
      setSuccessMessage('Document deleted successfully.');
      // Clear the query param from URL without refresh
      window.history.replaceState({}, '', '/pilot/sources');
    }
  }, [searchParams]);

  // Auto-hide success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load active workspace from localStorage
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(LS_WORKSPACE_ID);
      const savedName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedId) setWorkspaceId(savedId);
      if (savedName) setWorkspaceName(savedName);
    } catch {
      // Ignore
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (corpusFilter !== 'all') {
        params.set('corpus', corpusFilter);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const url = `/api/workspaces/${workspaceId}/documents${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to fetch documents'
            : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
        );
        return;
      }

      if (parsed.kind !== 'json') {
        setError(`Expected JSON but got:\n${String(parsed.data).slice(0, 1000)}`);
        return;
      }

      setDocuments((parsed.data as { documents?: Document[] }).documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, corpusFilter, debouncedSearch]);

  // Refetch when workspace or filters change
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Delete document
  const handleDelete = useCallback(
    async (documentId: string) => {
      if (!workspaceId) return;

      setDeleting(documentId);
      setError(null);

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
          setError(
            parsed.kind === 'json'
              ? (parsed.data as { error?: string }).error || 'Failed to delete document'
              : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
          );
          return;
        }

        // Remove from list
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
        setSuccessMessage('Document deleted successfully.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete document');
      } finally {
        setDeleting(null);
        setDeleteConfirm(null);
      }
    },
    [workspaceId]
  );

  // Count by corpus
  const docsCount = documents.filter((d) => d.corpus === 'docs').length;
  const kbCount = documents.filter((d) => d.corpus === 'kb').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="mt-1 text-gray-600">
          View documents ingested into the active workspace.
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Active workspace */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-blue-800 mb-2">Active Workspace</h2>
        {workspaceId ? (
          <div className="flex items-center gap-3">
            <span className="font-medium text-blue-900">{workspaceName}</span>
            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs font-mono text-blue-700">
              {workspaceId}
            </code>
            <Link
              href="/pilot/workspaces"
              className="text-sm text-blue-600 hover:text-blue-800 ml-auto"
            >
              Change
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-blue-700">
              No active workspace. Select one to view sources.
            </p>
            <Link
              href="/pilot/workspaces"
              className="text-sm text-blue-600 hover:text-blue-800 ml-auto"
            >
              Select Workspace
            </Link>
          </div>
        )}
      </section>

      {/* Only show content if workspace is selected */}
      {workspaceId && (
        <>
          {/* Filters */}
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Corpus filter pills */}
              <div className="flex gap-2">
                <FilterPill
                  label="All"
                  count={documents.length}
                  active={corpusFilter === 'all'}
                  onClick={() => setCorpusFilter('all')}
                />
                <FilterPill
                  label="Docs"
                  count={docsCount}
                  active={corpusFilter === 'docs'}
                  onClick={() => setCorpusFilter('docs')}
                />
                <FilterPill
                  label="KB"
                  count={kbCount}
                  active={corpusFilter === 'kb'}
                  onClick={() => setCorpusFilter('kb')}
                />
              </div>

              {/* Search input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or canonical ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Documents list */}
          <section className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-900">
                Documents {!loading && `(${documents.length})`}
              </h2>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : documents.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                {debouncedSearch || corpusFilter !== 'all'
                  ? 'No documents match your filters.'
                  : 'No documents yet. Use the Ingest page to add sources.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    isConfirming={deleteConfirm === doc.id}
                    isDeleting={deleting === doc.id}
                    onDeleteClick={() => setDeleteConfirm(doc.id)}
                    onDeleteConfirm={() => handleDelete(doc.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Filter pill component */
function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
      <span
        className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
          active ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Document row component */
function DocumentRow({
  document,
  isConfirming,
  isDeleting,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  document: Document;
  isConfirming: boolean;
  isDeleting: boolean;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const displayTitle = document.title || document.canonicalId;
  const updatedAt = new Date(document.updatedAt).toLocaleDateString();

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Corpus badge */}
        <span
          className={`mt-0.5 px-1.5 py-0.5 text-xs font-medium rounded ${
            document.corpus === 'docs'
              ? 'bg-green-100 text-green-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {document.corpus}
        </span>

        {/* Document info - clickable link */}
        <Link
          href={`/pilot/sources/${document.id}`}
          className="flex-1 min-w-0 group"
        >
          <div className="font-medium text-gray-900 truncate group-hover:text-blue-600">
            {displayTitle}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {document.route && (
              <span className="font-mono bg-gray-100 px-1 rounded">
                {document.route}
              </span>
            )}
            <span>{document.chunkCount} chunks</span>
            <span>Updated {updatedAt}</span>
          </div>
        </Link>

        {/* Actions */}
        {isConfirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-red-600">Delete?</span>
            <button
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {isDeleting ? 'Deleting...' : 'Yes'}
            </button>
            <button
              onClick={onDeleteCancel}
              disabled={isDeleting}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDeleteClick}
              className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200"
            >
              Delete
            </button>
            <Link
              href={`/pilot/sources/${document.id}`}
              className="text-gray-400 hover:text-gray-600"
            >
              &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
