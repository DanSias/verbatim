'use client';

/**
 * Pilot Workspaces Page
 *
 * Manage workspaces: list, create, delete, and set active workspace.
 */

import { useState, useEffect, useCallback } from 'react';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';

/** Workspace from API */
interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

async function readJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { kind: 'json' as const, data: await res.json() };
  }
  return { kind: 'text' as const, data: await res.text() };
}

export default function PilotWorkspacesPage() {
  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active workspace from localStorage
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load active workspace from localStorage
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(LS_WORKSPACE_ID);
      const savedName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedId) setActiveWorkspaceId(savedId);
      if (savedName) setActiveWorkspaceName(savedName);
    } catch {
      // Ignore
    }
  }, []);

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
      if (activeWorkspaceId === id) {
        try {
          localStorage.removeItem(LS_WORKSPACE_ID);
          localStorage.removeItem(LS_WORKSPACE_NAME);
          setActiveWorkspaceId(null);
          setActiveWorkspaceName(null);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  }, [activeWorkspaceId]);

  // Set active workspace
  const handleSetActive = useCallback((workspace: Workspace) => {
    try {
      localStorage.setItem(LS_WORKSPACE_ID, workspace.id);
      localStorage.setItem(LS_WORKSPACE_NAME, workspace.name);
      setActiveWorkspaceId(workspace.id);
      setActiveWorkspaceName(workspace.name);
    } catch {
      // Ignore
    }
  }, []);

  // Clear active workspace
  const handleClearActive = useCallback(() => {
    try {
      localStorage.removeItem(LS_WORKSPACE_ID);
      localStorage.removeItem(LS_WORKSPACE_NAME);
      setActiveWorkspaceId(null);
      setActiveWorkspaceName(null);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workspaces</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Manage workspaces for document ingestion and retrieval.
        </p>
      </div>

      {/* Active workspace */}
      <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-4">
        <h2 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Active Workspace</h2>
        {activeWorkspaceId ? (
          <div className="flex items-center gap-3">
            <span className="font-medium text-blue-900 dark:text-blue-100">{activeWorkspaceName}</span>
            <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded text-xs font-mono text-blue-700 dark:text-blue-300">
              {activeWorkspaceId}
            </code>
            <button
              onClick={handleClearActive}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 ml-auto"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="text-sm text-blue-700 dark:text-blue-300">
            No active workspace. Select one from the list below.
          </p>
        )}
      </section>

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
                isActive={workspace.id === activeWorkspaceId}
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
  const createdAt = new Date(workspace.createdAt).toLocaleDateString();

  return (
    <div className={`px-4 py-3 ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <code className="font-mono">{workspace.id}</code>
            <span>Created {createdAt}</span>
          </div>
        </div>

        {/* Actions */}
        {isConfirming ? (
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            {!isActive && (
              <button
                onClick={onSetActive}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium rounded hover:bg-blue-200 dark:hover:bg-blue-900/60"
              >
                Use in Pilot
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
