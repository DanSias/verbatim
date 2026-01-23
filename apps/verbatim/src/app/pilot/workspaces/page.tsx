'use client';

/**
 * Pilot Workspaces Page
 *
 * Manage workspaces: list, create, delete, and set active workspace.
 * The active workspace is now primarily managed via the sidebar WorkspaceSwitcher,
 * but this page still allows setting a workspace as active for convenience.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useActiveWorkspace,
  setActiveWorkspaceInStorage,
} from '@/components/workspace-switcher';

/** Workspace from API */
interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  documentCount?: number;
  chunkCount?: number;
}

async function readJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { kind: 'json' as const, data: await res.json() };
  }
  return { kind: 'text' as const, data: await res.text() };
}

function formatRelativeTime(date: Date, now: Date = new Date()) {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const absSeconds = Math.abs(seconds);
  const future = seconds < 0;

  const minutes = Math.round(absSeconds / 60);
  const hours = Math.round(absSeconds / 3600);
  const days = Math.round(absSeconds / 86400);
  const weeks = Math.round(absSeconds / 604800);
  const months = Math.round(absSeconds / 2592000);

  const format = (value: number, unit: string) =>
    `${value} ${unit}${value === 1 ? '' : 's'} ${future ? 'from now' : 'ago'}`;

  if (absSeconds < 60) return future ? 'in under a minute' : 'just now';
  if (minutes < 60) return format(minutes, 'minute');
  if (hours < 24) return format(hours, 'hour');
  if (days < 7) return format(days, 'day');
  if (weeks < 5) return format(weeks, 'week');
  return format(months, 'month');
}

function shortenId(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function PilotWorkspacesPage() {
  // Active workspace from shared hook
  const { activeWorkspace, setActiveWorkspace } = useActiveWorkspace();

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/workspaces', {
        headers: { Accept: 'application/json' },
      });
      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to fetch workspaces'
            : `Non-JSON response from /api/workspaces:\n${String(parsed.data).slice(0, 1000)}`
        );
        return;
      }

      if (parsed.kind !== 'json') {
        setError(`Expected JSON from /api/workspaces but got:\n${String(parsed.data).slice(0, 1000)}`);
        return;
      }

      setWorkspaces((parsed.data as { workspaces?: Workspace[] }).workspaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Create workspace
  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError('Name is required');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name }),
      });

      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setCreateError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to create workspace'
            : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
        );
        return;
      }

      if (parsed.kind !== 'json') {
        setCreateError(`Expected JSON but got:\n${String(parsed.data).slice(0, 500)}`);
        return;
      }

      // Add to list
      setWorkspaces((prev) => [parsed.data as Workspace, ...prev]);
      setNewName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  }, [newName]);

  // Delete workspace
  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);

    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      const parsed = await readJsonOrText(res);

      if (!res.ok) {
        setError(
          parsed.kind === 'json'
            ? (parsed.data as { error?: string }).error || 'Failed to delete workspace'
            : `Non-JSON response:\n${String(parsed.data).slice(0, 1000)}`
        );
        return;
      }

      // Remove from list
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));

      // Clear active workspace if it was deleted
      if (activeWorkspace?.id === id) {
        setActiveWorkspaceInStorage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  }, [activeWorkspace?.id]);

  // Set active workspace (uses shared hook to broadcast change)
  const handleSetActive = useCallback((workspace: Workspace) => {
    setActiveWorkspace({ id: workspace.id, name: workspace.name });
  }, [setActiveWorkspace]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workspaces</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Manage workspaces for document ingestion and retrieval.
          Use the workspace switcher in the sidebar to change the active workspace.
        </p>
      </div>

      {/* Create workspace */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Create Workspace</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Workspace name"
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900"
            disabled={creating}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {createError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>
        )}
      </section>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Workspaces list */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            All Workspaces {!loading && `(${workspaces.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : workspaces.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
            No workspaces yet. Create one above.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === activeWorkspace?.id}
                isDeleting={deleting === workspace.id}
                isConfirming={deleteConfirm === workspace.id}
                onSetActive={() => handleSetActive(workspace)}
                onDeleteClick={() => setDeleteConfirm(workspace.id)}
                onDeleteConfirm={() => handleDelete(workspace.id)}
                onDeleteCancel={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Workspace row component */
function WorkspaceRow({
  workspace,
  isActive,
  isDeleting,
  isConfirming,
  onSetActive,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  workspace: Workspace;
  isActive: boolean;
  isDeleting: boolean;
  isConfirming: boolean;
  onSetActive: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const createdAtDate = new Date(workspace.createdAt);
  const relativeCreatedAt = formatRelativeTime(createdAtDate);
  const createdAtTitle = createdAtDate.toLocaleString();
  const documentCount = workspace.documentCount ?? 0;
  const chunkCount = workspace.chunkCount ?? 0;
  const documentLabel = documentCount === 1 ? 'document' : 'documents';
  const chunkLabel = chunkCount === 1 ? 'chunk' : 'chunks';
  const shortId = shortenId(workspace.id);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(workspace.id);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className={`px-4 py-3 ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{workspace.name}</span>
            {isActive && (
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                Active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span title={`Created ${createdAtTitle}`}>Created {relativeCreatedAt}</span>
            <span>
              {documentCount} {documentLabel} • {chunkCount} {chunkLabel}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500">
            <span className="font-mono" title={workspace.id}>
              {shortId}
            </span>
            <button
              type="button"
              onClick={handleCopyId}
              className="rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Copy workspace ID"
            >
              Copy ID
            </button>
            {copied && <span className="text-green-600 dark:text-green-400">Copied</span>}
          </div>
        </div>

        {/* Actions */}
        {isConfirming ? (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-red-600 dark:text-red-400">Delete?</span>
            <button
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {isDeleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={onDeleteCancel}
              disabled={isDeleting}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            {!isActive && (
              <button
                onClick={onSetActive}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium rounded hover:bg-blue-200 dark:hover:bg-blue-900/60"
              >
                Set Active
              </button>
            )}
            <button
              onClick={onDeleteClick}
              className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
