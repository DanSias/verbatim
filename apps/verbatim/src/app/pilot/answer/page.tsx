'use client';

/**
 * Pilot Answer Page
 *
 * LLM-powered answer UI for testing POST /api/answer endpoint.
 * Displays synthesized answers with citations, confidence, and ticket drafts.
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

/** Confidence levels */
type ConfidenceLevel = 'high' | 'medium' | 'low';
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low'];

/** Citation type */
interface AnswerCitation {
  index: number;
  corpus: 'docs' | 'kb';
  route?: string;
  anchor?: string | null;
  url?: string;
  sourcePath?: string;
}

/** Ticket draft type */
interface TicketDraft {
  title: string;
  summary: string[];
  userQuestion: string;
  attemptedAnswer?: string;
  suggestedNextInfo: string[];
  citations: AnswerCitation[];
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
  confidence: ConfidenceLevel;
  mode: 'answer' | 'ticket_draft';
  ticketDraft?: TicketDraft;
  debug: {
    provider: string;
    model: string;
    retrievalMode: 'vector' | 'keyword';
    topK: number;
    corpusScope: string[];
    chunksUsed: number;
    confidenceSignals: {
      topScore: number;
      secondScore: number;
      scoreGap: number;
      docsCount: number;
      kbCount: number;
      hasDocsTop1: boolean;
      resultCount: number;
      suggestedRoutesCount: number;
      avgTop3Score: number;
    };
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
  const [forceTicketDraft, setForceTicketDraft] = useState(false);
  const [minConfidence, setMinConfidence] = useState<ConfidenceLevel | ''>('');

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Persist settings
  useEffect(() => {
    try {
      if (workspaceId) localStorage.setItem(LS_WORKSPACE_ID, workspaceId);
      localStorage.setItem(LS_TOP_K, String(topK));
      localStorage.setItem(LS_CORPUS_SCOPE, JSON.stringify(corpusScope));
      localStorage.setItem(LS_PROVIDER, provider);
    } catch {
      // Ignore
    }
  }, [workspaceId, topK, corpusScope, provider]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
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
    setCopied(false);

    try {
      const requestBody: Record<string, unknown> = {
        workspaceId: workspaceId.trim(),
        question: question.trim(),
        topK,
        corpusScope: scope,
        provider,
      };

      if (forceTicketDraft) {
        requestBody.forceTicketDraft = true;
      }

      if (minConfidence) {
        requestBody.minConfidence = minConfidence;
      }

      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
  }, [workspaceId, question, topK, corpusScope, provider, forceTicketDraft, minConfidence]);

  // Handle Enter key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Copy ticket draft to clipboard
  const handleCopyTicketDraft = useCallback(() => {
    if (!response?.ticketDraft) return;

    const draft = response.ticketDraft;
    const lines: string[] = [];

    lines.push(`Title: ${draft.title}`);
    lines.push('');
    lines.push('Summary:');
    draft.summary.forEach((point) => lines.push(`  - ${point}`));
    lines.push('');
    lines.push(`Original Question: ${draft.userQuestion}`);

    if (draft.attemptedAnswer) {
      lines.push('');
      lines.push('Attempted Answer:');
      lines.push(draft.attemptedAnswer);
    }

    lines.push('');
    lines.push('Suggested Next Steps:');
    draft.suggestedNextInfo.forEach((point) => lines.push(`  - ${point}`));

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

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [response]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Answer</h1>
        <p className="mt-1 text-gray-600">
          Get LLM-synthesized answers with citations, confidence scoring, and ticket drafts.
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

        {/* Options row 1 */}
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
              Top K
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

        {/* Options row 2 - Ticket draft controls */}
        <div className="flex flex-wrap gap-6 pt-2 border-t border-gray-100">
          {/* Force ticket draft */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceTicketDraft}
                onChange={(e) => setForceTicketDraft(e.target.checked)}
                disabled={loading}
                className="text-blue-600 focus:ring-blue-500 rounded"
              />
              <span className="text-sm text-gray-700">Force ticket draft</span>
            </label>
          </div>

          {/* Min confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Confidence
            </label>
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(e.target.value as ConfidenceLevel | '')}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">None</option>
              {CONFIDENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
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
          {/* Mode and Confidence badges */}
          <div className="flex items-center gap-3">
            <ModeBadge mode={response.mode} />
            <ConfidenceBadge confidence={response.confidence} />
          </div>

          {/* Answer */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Answer</h2>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {response.answer}
            </div>
          </div>

          {/* Ticket Draft */}
          {response.ticketDraft && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-amber-900">Ticket Draft</h2>
                <button
                  onClick={handleCopyTicketDraft}
                  className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <h3 className="text-sm font-medium text-amber-800 mb-1">Title</h3>
                  <p className="text-sm text-gray-800 bg-white rounded px-3 py-2 border border-amber-200">
                    {response.ticketDraft.title}
                  </p>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-amber-800 mb-1">Summary</h3>
                  <ul className="text-sm text-gray-800 bg-white rounded px-3 py-2 border border-amber-200 space-y-1">
                    {response.ticketDraft.summary.map((point, i) => (
                      <li key={i}>• {point}</li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Next Info */}
                <div>
                  <h3 className="text-sm font-medium text-amber-800 mb-1">Suggested Next Steps</h3>
                  <ul className="text-sm text-gray-800 bg-white rounded px-3 py-2 border border-amber-200 space-y-1">
                    {response.ticketDraft.suggestedNextInfo.map((point, i) => (
                      <li key={i}>• {point}</li>
                    ))}
                  </ul>
                </div>

                {/* Draft Citations */}
                {response.ticketDraft.citations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-amber-800 mb-1">Related Documentation</h3>
                    <ul className="text-sm bg-white rounded px-3 py-2 border border-amber-200 space-y-1">
                      {response.ticketDraft.citations.map((citation) => (
                        <li key={citation.index} className="flex items-center gap-2">
                          <span className="text-gray-500">[{citation.index}]</span>
                          {citation.corpus === 'docs' && citation.url ? (
                            <Link href={citation.url} className="text-blue-600 hover:underline">
                              {citation.url}
                            </Link>
                          ) : (
                            <span className="text-gray-700">{citation.sourcePath}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

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
            <div className="px-4 pb-4 space-y-4">
              {/* Basic debug */}
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

              {/* Confidence signals */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Confidence Signals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3">
                  <div>
                    <span className="text-gray-500">Top Score:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.topScore.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">2nd Score:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.secondScore.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Score Gap:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.scoreGap.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Docs Count:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.docsCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">KB Count:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.kbCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Docs Top1:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.hasDocsTop1 ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Top3:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.avgTop3Score.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Result Count:</span>{' '}
                    <span className="font-mono">{response.debug.confidenceSignals.resultCount}</span>
                  </div>
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

/** Mode badge component */
function ModeBadge({ mode }: { mode: 'answer' | 'ticket_draft' }) {
  const styles = {
    answer: 'bg-green-100 text-green-800',
    ticket_draft: 'bg-amber-100 text-amber-800',
  };

  const labels = {
    answer: 'Answer Mode',
    ticket_draft: 'Ticket Draft Mode',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[mode]}`}>
      {labels[mode]}
    </span>
  );
}

/** Confidence badge component */
function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const styles = {
    high: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[confidence]}`}>
      Confidence: {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
    </span>
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
