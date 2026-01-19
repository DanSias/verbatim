'use client';

/**
 * Pilot Landing Page
 *
 * Entry point for internal testing UI.
 * Shows current workspace ID and links to ingest/ask pages.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';

export default function PilotPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load workspace from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedId = localStorage.getItem(LS_WORKSPACE_ID);
      const savedName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedId) setWorkspaceId(savedId);
      if (savedName) setWorkspaceName(savedName);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleClearWorkspace = () => {
    try {
      localStorage.removeItem(LS_WORKSPACE_ID);
      localStorage.removeItem(LS_WORKSPACE_NAME);
      setWorkspaceId(null);
      setWorkspaceName(null);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pilot UI</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Internal testing interface for Verbatim. Upload documents and test retrieval.
        </p>
      </div>

      {/* Workspace status */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Workspace</h2>
          <Link
            href="/pilot/workspaces"
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Manage workspaces
          </Link>
        </div>
        {mounted ? (
          workspaceId ? (
            <div className="flex items-center gap-3">
              {workspaceName && (
                <span className="font-medium text-gray-900 dark:text-gray-100">{workspaceName}</span>
              )}
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                {workspaceId}
              </code>
              <button
                onClick={handleClearWorkspace}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No workspace set.{' '}
              <Link href="/pilot/workspaces" className="text-blue-600 dark:text-blue-400 hover:underline">
                Create or select a workspace
              </Link>
              .
            </p>
          )
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
        )}
      </section>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ingest card */}
        <Link
          href="/pilot/ingest"
          className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ingest Documents</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Upload docs (MDX) or KB (Markdown) files to a workspace.
          </p>
          <span className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">
            Go to Ingest &rarr;
          </span>
        </Link>

        {/* Sources card */}
        <Link
          href="/pilot/sources"
          className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">View Sources</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Explore uploaded documents and chunks for a workspace.
          </p>
          <span className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">
            Go to Sources &rarr;
          </span>
        </Link>

        {/* Ask card */}
        <Link
          href="/pilot/ask"
          className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ask Questions</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Query the retrieval API and view ranked results with citations.
          </p>
          <span className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">
            Go to Ask &rarr;
          </span>
        </Link>
      </div>

      {/* Fixtures reminder */}
      <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-4">
        <h2 className="text-sm font-medium text-amber-800 dark:text-amber-200">Testing with Fixtures</h2>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          Test fixture files are available in <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">fixtures</code>.
          Use folder upload on the Ingest page to upload docs or kb fixtures for testing.
        </p>
      </section>
    </div>
  );
}
