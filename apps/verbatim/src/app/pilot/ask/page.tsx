'use client';

/**
 * Pilot Ask Page
 *
 * Query UI for testing POST /api/ask endpoint.
 * Displays retrieval results with citations and suggested routes.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';
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

export default function PilotAskPage() {
  // Form state
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
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

  // Load persisted values
  useEffect(() => {
    try {
      const savedWorkspaceId = localStorage.getItem(LS_WORKSPACE_ID);
      if (savedWorkspaceId) setWorkspaceId(savedWorkspaceId);

      const savedWorkspaceName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedWorkspaceName) setWorkspaceName(savedWorkspaceName);

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

  // Persist workspace ID
  useEffect(() => {
    try {
      if (workspaceId) {
        localStorage.setItem(LS_WORKSPACE_ID, workspaceId);
      }
    } catch {
      // Ignore
    }
  }, [workspaceId]);

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
      setError('Workspace ID is required');
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ask</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Query the retrieval API and view ranked results with citations.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4">
        {/* Workspace ID */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Workspace ID
            </label>
            <Link
              href="/pilot/workspaces"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Manage workspaces
            </Link>
          </div>
          {workspaceName && workspaceId && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Active:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{workspaceName}</span>
              <Link
                href="/pilot/workspaces"
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Change
              </Link>
            </div>
          )}
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="e.g., clx123abc..."
            className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900"
            disabled={loading}
          />
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
          {/* Corpus scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Corpus Scope
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
                <span className="text-sm text-gray-700 dark:text-gray-300">docs</span>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">kb</span>
              </label>
            </div>
          </div>

          {/* Top K */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Top K
            </label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10) || 8)}
              min={1}
              max={50}
              className="w-20 px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900"
              disabled={loading}
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
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
