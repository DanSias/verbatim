'use client';

/**
 * Pilot Answer Page
 *
 * LLM-powered answer UI for testing POST /api/answer endpoint.
 * Displays synthesized answers with citations and suggested routes.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';
const LS_TOP_K = 'verbatim_pilot_answer_topK';
const LS_CORPUS_SCOPE = 'verbatim_pilot_answer_corpusScope';
const LS_PROVIDER = 'verbatim_pilot_answer_provider';

/** LLM Providers */
type Provider = 'gemini' | 'openai' | 'anthropic';
const PROVIDERS: Provider[] = ['gemini', 'openai', 'anthropic'];

/** Citation type */
interface AnswerCitation {
  index: number;
  corpus: 'docs' | 'kb';
  route?: string;
  anchor?: string | null;
  url?: string;
  sourcePath?: string;
}

/** Response type from /api/answer */
interface AnswerResponse {
  question: string;
  workspaceId: string;
  answer: string;
  citations: AnswerCitation[];
  suggestedRoutes: Array<{
    route: string;
    title: string | null;
  }>;
  debug: {
    provider: string;
    model: string;
    retrievalMode: 'vector' | 'keyword';
    topK: number;
    corpusScope: string[];
    chunksUsed: number;
  };
}

export default function PilotAnswerPage() {
  // Form state
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [corpusScope, setCorpusScope] = useState<{ docs: boolean; kb: boolean }>({
    docs: true,
    kb: true,
  });
  const [topK, setTopK] = useState(6);
  const [provider, setProvider] = useState<Provider>('gemini');

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnswerResponse | null>(null);

  // Load persisted values
  useEffect(() => {
    try {
      const savedWorkspaceId = localStorage.getItem(LS_WORKSPACE_ID);
      if (savedWorkspaceId) setWorkspaceId(savedWorkspaceId);

      const savedWorkspaceName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedWorkspaceName) setWorkspaceName(savedWorkspaceName);

      const savedTopK = localStorage.getItem(LS_TOP_K);
      if (savedTopK) setTopK(parseInt(savedTopK, 10) || 6);

      const savedCorpusScope = localStorage.getItem(LS_CORPUS_SCOPE);
      if (savedCorpusScope) {
        const parsed = JSON.parse(savedCorpusScope);
        if (typeof parsed.docs === 'boolean' && typeof parsed.kb === 'boolean') {
          setCorpusScope(parsed);
        }
      }

      const savedProvider = localStorage.getItem(LS_PROVIDER);
      if (savedProvider && PROVIDERS.includes(savedProvider as Provider)) {
        setProvider(savedProvider as Provider);
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

  // Persist provider
  useEffect(() => {
    try {
      localStorage.setItem(LS_PROVIDER, provider);
    } catch {
      // Ignore
    }
  }, [provider]);

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
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceId.trim(),
          question: question.trim(),
          topK,
          corpusScope: scope,
          provider,
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
  }, [workspaceId, question, topK, corpusScope, provider]);

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
        <h1 className="text-2xl font-bold text-gray-900">Answer</h1>
        <p className="mt-1 text-gray-600">
          Get LLM-synthesized answers with citations from the retrieval API.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {/* Workspace ID */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Workspace ID
            </label>
            <Link
              href="/pilot/workspaces"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Manage workspaces
            </Link>
          </div>
          {workspaceName && workspaceId && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-gray-600">Active:</span>
              <span className="font-medium text-gray-900">{workspaceName}</span>
              <Link
                href="/pilot/workspaces"
                className="text-xs text-blue-600 hover:text-blue-800"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
        </div>

        {/* Question */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your question... (Enter to submit, Shift+Enter for newline)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            disabled={loading}
          />
        </div>

        {/* Options row */}
        <div className="flex flex-wrap gap-6">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LLM Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Corpus scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <span className="text-sm text-gray-700">docs</span>
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
                <span className="text-sm text-gray-700">kb</span>
              </label>
            </div>
          </div>

          {/* Top K */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Top K Sources
            </label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10) || 6)}
              min={1}
              max={20}
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Get Answer'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Response display */}
      {response && (
        <div className="space-y-6">
          {/* Answer */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Answer</h2>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {response.answer}
            </div>
          </div>

          {/* Citations */}
          {response.citations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-3">
                Citations ({response.citations.length})
              </h2>
              <ul className="space-y-2">
                {response.citations.map((citation) => (
                  <li key={citation.index} className="flex items-start gap-2 text-sm">
                    <span className="font-mono text-gray-500 flex-shrink-0">
                      [{citation.index}]
                    </span>
                    <CorpusBadge corpus={citation.corpus} />
                    {citation.corpus === 'docs' && citation.url ? (
                      <Link
                        href={citation.url}
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {citation.route}
                        {citation.anchor && `#${citation.anchor}`}
                      </Link>
                    ) : (
                      <span className="text-gray-600 font-mono">
                        {citation.sourcePath}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested routes */}
          {response.suggestedRoutes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-2">
                Suggested Routes
              </h2>
              <ul className="space-y-1">
                {response.suggestedRoutes.map((route, i) => (
                  <li key={i} className="text-sm">
                    <Link
                      href={route.route}
                      className="text-blue-600 hover:underline font-mono"
                    >
                      {route.route}
                    </Link>
                    {route.title && (
                      <span className="text-gray-500 ml-2">— {route.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Debug info */}
          <details className="bg-white border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
              Debug Information
            </summary>
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Provider:</span>{' '}
                  <span className="font-medium">{response.debug.provider}</span>
                </div>
                <div>
                  <span className="text-gray-500">Model:</span>{' '}
                  <span className="font-medium">{response.debug.model}</span>
                </div>
                <div>
                  <span className="text-gray-500">Retrieval:</span>{' '}
                  <span className="font-medium">{response.debug.retrievalMode}</span>
                </div>
                <div>
                  <span className="text-gray-500">Top K:</span>{' '}
                  <span className="font-medium">{response.debug.topK}</span>
                </div>
                <div>
                  <span className="text-gray-500">Chunks Used:</span>{' '}
                  <span className="font-medium">{response.debug.chunksUsed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Corpus:</span>{' '}
                  <span className="font-medium">{response.debug.corpusScope.join(', ')}</span>
                </div>
              </div>
            </div>
          </details>

          {/* Raw JSON */}
          <details className="bg-white border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
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

/** Corpus badge component */
function CorpusBadge({ corpus }: { corpus: 'docs' | 'kb' }) {
  const styles = {
    docs: 'bg-blue-100 text-blue-800',
    kb: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${styles[corpus]}`}>
      {corpus}
    </span>
  );
}
