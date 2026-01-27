'use client';

/**
 * Pilot Ask Page
 *
 * Query UI for testing POST /api/ask endpoint.
 * Displays retrieval results with citations and suggested routes.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveWorkspace } from '@/components/workspace-switcher';
import { RecentQueries } from '@/components/query-runs';

/** LocalStorage keys for non-workspace settings */
const LS_TOP_K = 'verbatim_pilot_topK';
const LS_CORPUS_SCOPE = 'verbatim_pilot_corpusScope';

/** Response type from /api/ask */
interface AskResponse {
  question: string;
  workspaceId: string;
  conversationId: string;
  results: Array<{
    corpus: 'docs' | 'kb';
    documentId: string;
    canonicalId: string;
    chunkId: string;
    headingPath: string[];
    score: number;
    citation: {
      route?: string;
      anchor?: string | null;
      url?: string;
      sourcePath?: string;
    };
    excerpt: string;
  }>;
  suggestedRoutes: Array<{
    route: string;
    title: string | null;
  }>;
  debug: {
    retrievalMode: 'vector' | 'keyword';
    totalChunksScanned: number;
    topK: number;
    corpusScope: string[];
  };
}

interface WorkspaceStats {
  documentCount: number;
  chunkCount: number;
}

interface WorkspaceWithCounts {
  id: string;
  name: string;
  documentCount?: number;
  chunkCount?: number;
}

export default function PilotAskPage() {
  // Active workspace from shared hook
  const { activeWorkspace } = useActiveWorkspace();

  // Workspace stats
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const workspaceId = activeWorkspace?.id || '';

  const [question, setQuestion] = useState('');
  const [corpusScope, setCorpusScope] = useState<{ docs: boolean; kb: boolean }>({
    docs: true,
    kb: true,
  });
  const [topK, setTopK] = useState(8);

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);

  // Fetch active workspace stats
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      if (!workspaceId) {
        setWorkspaceStats(null);
        setStatsError(null);
        return;
      }

      setStatsLoading(true);
      setStatsError(null);

      try {
        const res = await fetch('/api/workspaces', {
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch workspace stats');
        }

        const list = Array.isArray(data.workspaces) ? (data.workspaces as WorkspaceWithCounts[]) : [];
        const match = list.find((ws) => ws.id === workspaceId);

        if (!cancelled) {
          setWorkspaceStats({
            documentCount: match?.documentCount ?? 0,
            chunkCount: match?.chunkCount ?? 0,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setWorkspaceStats(null);
          setStatsError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Load persisted non-workspace settings
  useEffect(() => {
    try {
      const savedTopK = localStorage.getItem(LS_TOP_K);
      if (savedTopK) setTopK(parseInt(savedTopK, 10) || 8);

      const savedCorpusScope = localStorage.getItem(LS_CORPUS_SCOPE);
      if (savedCorpusScope) {
        const parsed = JSON.parse(savedCorpusScope);
        if (typeof parsed.docs === 'boolean' && typeof parsed.kb === 'boolean') {
          setCorpusScope(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist topK
  useEffect(() => {
    try {
      localStorage.setItem(LS_TOP_K, String(topK));
    } catch {
      // Ignore
    }
  }, [topK]);

  // Persist corpus scope
  useEffect(() => {
    try {
      localStorage.setItem(LS_CORPUS_SCOPE, JSON.stringify(corpusScope));
    } catch {
      // Ignore
    }
  }, [corpusScope]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validate inputs
    if (!workspaceId.trim()) {
      setError('Select an active workspace to continue');
      return;
    }
    if (!question.trim()) {
      setError('Question is required');
      return;
    }

    const scope: string[] = [];
    if (corpusScope.docs) scope.push('docs');
    if (corpusScope.kb) scope.push('kb');

    if (scope.length === 0) {
      setError('Select at least one corpus');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceId.trim(),
          question: question.trim(),
          topK,
          corpusScope: scope,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, question, topK, corpusScope]);

  // Handle Enter key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Ask: Explore Retrieved Context
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          See exactly what Verbatim finds in your workspace before an answer is generated.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4">
        {/* Active workspace */}
        <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {activeWorkspace
                ? `${activeWorkspace.name} Workspace`
                : 'No active workspace selected'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {statsLoading && 'Loading workspace stats...'}
              {!statsLoading && workspaceStats && (
                <>
                  {workspaceStats.documentCount} documents • {workspaceStats.chunkCount} chunks
                </>
              )}
              {!statsLoading && !workspaceStats && !statsError && '0 documents • 0 chunks'}
            </span>
          </div>
          {!activeWorkspace && (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link
                href="/pilot/workspaces"
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Workspaces
              </Link>
              <span className="text-gray-500 dark:text-gray-400">
                or select one in the sidebar.
              </span>
            </div>
          )}
          {statsError && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Unable to load workspace stats. Asking still works.
            </p>
          )}
        </div>

        {/* Question */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your question... (Enter to submit, Shift+Enter for newline)"
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900 resize-y"
            disabled={loading}
          />
        </div>

        {/* Options row */}
        <div className="flex flex-wrap gap-6">
          {/* Search in */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search in
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={corpusScope.docs}
                  onChange={(e) =>
                    setCorpusScope((prev) => ({ ...prev, docs: e.target.checked }))
                  }
                  disabled={loading}
                  className="text-blue-600 focus:ring-blue-500 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Docs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={corpusScope.kb}
                  onChange={(e) =>
                    setCorpusScope((prev) => ({ ...prev, kb: e.target.checked }))
                  }
                  disabled={loading}
                  className="text-blue-600 focus:ring-blue-500 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Knowledge Base</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Choose which sources to search.
            </p>
          </div>

          {/* Results to consider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Results to consider
            </label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10) || 8)}
              min={1}
              max={10}
              className="w-20 px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Higher values may add context but can increase latency and cost.
            </p>
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !workspaceId.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Ask'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Response display */}
      {response && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-lg p-4">
            <h2 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Summary</h2>
            <div className="flex flex-wrap gap-4 text-sm text-green-700 dark:text-green-300">
              <span>
                <strong>Results:</strong> {response.results.length}
              </span>
              <span>
                <strong>Mode:</strong> {response.debug.retrievalMode}
              </span>
              <span>
                <strong>Chunks scanned:</strong> {response.debug.totalChunksScanned}
              </span>
            </div>
          </div>

          {/* Suggested routes */}
          {response.suggestedRoutes.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Suggested Routes
              </h2>
              <ul className="space-y-1">
                {response.suggestedRoutes.map((route, i) => (
                  <li key={i} className="text-sm">
                    <Link
                      href={route.route}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                    >
                      {route.route}
                    </Link>
                    {route.title && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">— {route.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results list */}
          {response.results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Results</h2>
              {response.results.map((result, i) => (
                <ResultCard key={result.chunkId} result={result} rank={i + 1} />
              ))}
            </div>
          )}

          {/* Raw JSON */}
          <details className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Raw JSON Response
            </summary>
            <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto rounded-b-lg max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Recent queries */}
      <RecentQueries workspaceId={workspaceId} />
    </div>
  );
}

/** Result card component */
function ResultCard({
  result,
  rank,
}: {
  result: AskResponse['results'][number];
  rank: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg font-bold text-gray-400 dark:text-gray-500">#{rank}</span>
        <CorpusBadge corpus={result.corpus} />
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          score: {result.score}
        </span>
      </div>

      {/* Canonical ID */}
      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-2">
        {result.canonicalId}
      </div>

      {/* Heading path */}
      {result.headingPath.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 italic mb-2">
          {result.headingPath.join(' > ')}
        </div>
      )}

      {/* Citation */}
      <div className="text-sm mb-3">
        {result.citation.url ? (
          <Link
            href={result.citation.url}
            className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
          >
            {result.citation.route}
            {result.citation.anchor && `#${result.citation.anchor}`}
          </Link>
        ) : (
          <span className="text-gray-600 dark:text-gray-400 font-mono">
            {result.citation.sourcePath}
          </span>
        )}
      </div>

      {/* Excerpt */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {result.excerpt}
      </div>
    </div>
  );
}

/** Corpus badge component */
function CorpusBadge({ corpus }: { corpus: 'docs' | 'kb' }) {
  const styles = {
    docs: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    kb: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[corpus]}`}>
      {corpus}
    </span>
  );
}
