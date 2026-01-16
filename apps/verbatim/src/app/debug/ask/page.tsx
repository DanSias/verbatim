'use client';

/**
 * Debug Ask Page
 *
 * Internal/dev-only page to test POST /api/ask endpoint.
 * See ARCHITECTURE.md Section 13.3.
 */

import { useState, useEffect, useCallback } from 'react';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_debug_workspaceId';
const LS_CORPUS_SCOPE = 'verbatim_debug_corpusScope';
const LS_TOP_K = 'verbatim_debug_topK';

/** Example questions */
const EXAMPLE_QUESTIONS = [
  'How do I set up webhooks?',
  'What are the chargeback resolution steps?',
  'How do I configure merchant accounts?',
];

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

export default function DebugAskPage() {
  // Form state
  const [workspaceId, setWorkspaceId] = useState('');
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

  // Load persisted values from localStorage
  useEffect(() => {
    try {
      const savedWorkspaceId = localStorage.getItem(LS_WORKSPACE_ID);
      if (savedWorkspaceId) setWorkspaceId(savedWorkspaceId);

      const savedCorpusScope = localStorage.getItem(LS_CORPUS_SCOPE);
      if (savedCorpusScope) setCorpusScope(JSON.parse(savedCorpusScope));

      const savedTopK = localStorage.getItem(LS_TOP_K);
      if (savedTopK) setTopK(parseInt(savedTopK, 10));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist values to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_WORKSPACE_ID, workspaceId);
    } catch {
      // Ignore
    }
  }, [workspaceId]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CORPUS_SCOPE, JSON.stringify(corpusScope));
    } catch {
      // Ignore
    }
  }, [corpusScope]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TOP_K, String(topK));
    } catch {
      // Ignore
    }
  }, [topK]);

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

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Build corpus scope array
      const scope: string[] = [];
      if (corpusScope.docs) scope.push('docs');
      if (corpusScope.kb) scope.push('kb');

      if (scope.length === 0) {
        setError('Select at least one corpus');
        setLoading(false);
        return;
      }

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

  return (
    <main style={styles.main}>
      <h1>Debug: Ask Endpoint</h1>
      <p style={styles.subtitle}>
        Test POST /api/ask and inspect retrieval results.
      </p>

      {/* Form */}
      <section style={styles.form}>
        {/* Workspace ID */}
        <div style={styles.field}>
          <label style={styles.label}>Workspace ID</label>
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="e.g., clx123abc..."
            style={styles.input}
          />
        </div>

        {/* Question */}
        <div style={styles.field}>
          <label style={styles.label}>Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question..."
            rows={3}
            style={styles.textarea}
          />
        </div>

        {/* Example questions */}
        <div style={styles.examples}>
          <span style={styles.exampleLabel}>Examples:</span>
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => setQuestion(q)}
              style={styles.exampleButton}
              type="button"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Options row */}
        <div style={styles.optionsRow}>
          {/* Corpus scope */}
          <div style={styles.field}>
            <label style={styles.label}>Corpus Scope</label>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={corpusScope.docs}
                  onChange={(e) =>
                    setCorpusScope((prev) => ({ ...prev, docs: e.target.checked }))
                  }
                />
                docs
              </label>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={corpusScope.kb}
                  onChange={(e) =>
                    setCorpusScope((prev) => ({ ...prev, kb: e.target.checked }))
                  }
                />
                kb
              </label>
            </div>
          </div>

          {/* Top K */}
          <div style={styles.field}>
            <label style={styles.label}>Top K</label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10) || 8)}
              min={1}
              max={50}
              style={{ ...styles.input, width: '80px' }}
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={styles.submitButton}
          type="button"
        >
          {loading ? 'Loading...' : 'Ask'}
        </button>
      </section>

      {/* Error display */}
      {error && (
        <section style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </section>
      )}

      {/* Response display */}
      {response && (
        <section style={styles.responseSection}>
          <h2>Response</h2>

          {/* Summary */}
          <div style={styles.summary}>
            <p>
              <strong>Results:</strong> {response.results.length} chunks found
            </p>
            <p>
              <strong>Retrieval mode:</strong> {response.debug.retrievalMode}
            </p>
            <p>
              <strong>Chunks scanned:</strong> {response.debug.totalChunksScanned}
            </p>
          </div>

          {/* Suggested routes */}
          {response.suggestedRoutes.length > 0 && (
            <div style={styles.suggestedRoutes}>
              <h3>Suggested Routes</h3>
              <ul>
                {response.suggestedRoutes.map((r, i) => (
                  <li key={i}>
                    <code>{r.route}</code>
                    {r.title && <span> — {r.title}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results list */}
          {response.results.length > 0 && (
            <div style={styles.resultsList}>
              <h3>Results</h3>
              {response.results.map((result, i) => (
                <div key={result.chunkId} style={styles.resultCard}>
                  <div style={styles.resultHeader}>
                    <span style={styles.resultRank}>#{i + 1}</span>
                    <span
                      style={{
                        ...styles.corpusBadge,
                        backgroundColor: result.corpus === 'docs' ? '#3b82f6' : '#10b981',
                      }}
                    >
                      {result.corpus}
                    </span>
                    <span style={styles.score}>score: {result.score}</span>
                  </div>
                  <div style={styles.resultMeta}>
                    <code>{result.canonicalId}</code>
                  </div>
                  {result.headingPath.length > 0 && (
                    <div style={styles.headingPath}>
                      {result.headingPath.join(' > ')}
                    </div>
                  )}
                  <div style={styles.citation}>
                    {result.citation.url ? (
                      <span>
                        URL: <code>{result.citation.url}</code>
                      </span>
                    ) : (
                      <span>
                        Source: <code>{result.citation.sourcePath}</code>
                      </span>
                    )}
                  </div>
                  <div style={styles.excerpt}>{result.excerpt}</div>
                </div>
              ))}
            </div>
          )}

          {/* Raw JSON */}
          <details style={styles.rawJson}>
            <summary>Raw JSON Response</summary>
            <pre style={styles.jsonPre}>
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {/* Back link */}
      <div style={styles.backLink}>
        <a href="/debug">← Back to Debug</a>
      </div>
    </main>
  );
}

/** Inline styles (intentionally basic per requirements) */
const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
  },
  subtitle: {
    color: '#666',
    marginBottom: '24px',
  },
  form: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '24px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: '6px',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  examples: {
    marginBottom: '16px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    alignItems: 'center',
  },
  exampleLabel: {
    fontSize: '13px',
    color: '#666',
  },
  exampleButton: {
    padding: '4px 10px',
    fontSize: '12px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  optionsRow: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
  },
  checkboxGroup: {
    display: 'flex',
    gap: '16px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  errorBox: {
    padding: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#b91c1c',
    marginBottom: '24px',
  },
  responseSection: {
    marginBottom: '24px',
  },
  summary: {
    backgroundColor: '#f0fdf4',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  suggestedRoutes: {
    marginBottom: '16px',
  },
  resultsList: {
    marginBottom: '16px',
  },
  resultCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '12px',
    backgroundColor: 'white',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  resultRank: {
    fontWeight: 700,
    color: '#374151',
  },
  corpusBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'white',
    fontWeight: 600,
  },
  score: {
    fontSize: '12px',
    color: '#6b7280',
    marginLeft: 'auto',
  },
  resultMeta: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '4px',
  },
  headingPath: {
    fontSize: '13px',
    color: '#4b5563',
    marginBottom: '4px',
    fontStyle: 'italic',
  },
  citation: {
    fontSize: '12px',
    color: '#059669',
    marginBottom: '8px',
  },
  excerpt: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.5,
    backgroundColor: '#f9fafb',
    padding: '8px',
    borderRadius: '4px',
  },
  rawJson: {
    marginTop: '16px',
  },
  jsonPre: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    padding: '16px',
    borderRadius: '6px',
    overflow: 'auto',
    fontSize: '12px',
    maxHeight: '400px',
  },
  backLink: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  },
};
