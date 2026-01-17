'use client';

/**
 * VerbatimWidget
 *
 * A collapsible documentation assistant widget for the bottom-right corner.
 * Designed to be portable to the docs repo with minimal changes.
 *
 * Only renders when NEXT_PUBLIC_WIDGET_ENABLED=1
 */

import { useState, useEffect, useCallback, FormEvent } from 'react';

/** Citation from the answer */
interface Citation {
  index: number;
  corpus: 'docs' | 'kb';
  route?: string;
  anchor?: string;
  url?: string;
  sourcePath?: string;
}

/** Suggested route from the answer */
interface SuggestedRoute {
  route: string;
  title: string | null;
}

/** Ticket draft when confidence is low */
interface TicketDraft {
  title: string;
  summary: string[];
  userQuestion: string;
  attemptedAnswer?: string;
  suggestedNextInfo: string[];
  citations: Citation[];
}

/** Answer response from the API */
interface AnswerResponse {
  question: string;
  workspaceId: string;
  answer: string;
  citations: Citation[];
  suggestedRoutes: SuggestedRoute[];
  confidence: 'high' | 'medium' | 'low';
  mode: 'answer' | 'ticket_draft';
  ticketDraft?: TicketDraft;
  debug?: {
    provider?: string;
    model?: string;
    timeout?: boolean;
  };
}

/** Error response from the API */
interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/** LocalStorage key for persisting state */
const STORAGE_KEY = 'verbatim-widget-state';

/** Persisted state shape */
interface PersistedState {
  lastQuestion: string;
  lastResponse: AnswerResponse | null;
}

/** Load persisted state from localStorage */
function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as PersistedState;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/** Save state to localStorage */
function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/** Confidence badge colors */
const confidenceColors = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

/** Widget props */
interface VerbatimWidgetProps {
  /**
   * Optional headers to include with API requests.
   * Use this to pass custom headers like x-verbatim-workspace-id for pilot testing.
   */
  requestHeaders?: Record<string, string>;
}

/** Main widget component */
export function VerbatimWidget({ requestHeaders }: VerbatimWidgetProps = {}) {
  // Check if widget is enabled
  const isEnabled = process.env.NEXT_PUBLIC_WIDGET_ENABLED === '1';

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTicketDraft, setShowTicketDraft] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted) {
      setQuestion(persisted.lastQuestion);
      setResponse(persisted.lastResponse);
    }
  }, []);

  // Save state when it changes
  useEffect(() => {
    if (question || response) {
      savePersistedState({
        lastQuestion: question,
        lastResponse: response,
      });
    }
  }, [question, response]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!question.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);
      setShowTicketDraft(false);

      try {
        const res = await fetch('/api/widget/answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...requestHeaders,
          },
          body: JSON.stringify({ question: question.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errData = data as ErrorResponse;
          setError(errData.error || `Error: ${res.status}`);
          setResponse(null);
        } else {
          setResponse(data as AnswerResponse);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
        setResponse(null);
      } finally {
        setIsLoading(false);
      }
    },
    [question, isLoading, requestHeaders]
  );

  const handleCopyTicketDraft = useCallback(() => {
    if (!response?.ticketDraft) return;

    const draft = response.ticketDraft;
    const text = [
      `Title: ${draft.title}`,
      '',
      'Summary:',
      ...draft.summary.map((s) => `  - ${s}`),
      '',
      `Original Question: ${draft.userQuestion}`,
      draft.attemptedAnswer ? `\nAttempted Answer:\n${draft.attemptedAnswer}` : '',
      '',
      'Suggested Next Steps:',
      ...draft.suggestedNextInfo.map((s) => `  - ${s}`),
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [response]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setResponse(null);
    setError(null);
    setShowTicketDraft(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Don't render if not enabled
  if (!isEnabled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors"
          aria-label="Open documentation assistant"
        >
          <QuestionIcon />
          <span className="font-medium">Ask Docs</span>
        </button>
      )}

      {/* Widget Panel */}
      {isOpen && (
        <div className="w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <h3 className="font-semibold">Documentation Assistant</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="text-blue-100 hover:text-white text-sm"
                title="Clear history"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-blue-100 hover:text-white"
                aria-label="Close widget"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Response */}
            {response && (
              <div className="space-y-4">
                {/* Confidence + Mode badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded border ${confidenceColors[response.confidence]}`}
                  >
                    {response.confidence.toUpperCase()} confidence
                  </span>
                  {response.mode === 'ticket_draft' && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded border bg-orange-100 text-orange-800 border-orange-200">
                      Ticket Draft Mode
                    </span>
                  )}
                  {response.debug?.timeout && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded border bg-gray-100 text-gray-600 border-gray-200">
                      Timeout fallback
                    </span>
                  )}
                </div>

                {/* Answer */}
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-800 whitespace-pre-wrap">{response.answer}</p>
                </div>

                {/* Citations */}
                {response.citations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Sources
                    </h4>
                    <div className="space-y-1">
                      {response.citations.map((citation) => (
                        <div key={citation.index} className="text-sm">
                          <span className="text-gray-400">[{citation.index}]</span>{' '}
                          {citation.corpus === 'docs' && citation.url ? (
                            <a
                              href={citation.url}
                              className="text-blue-600 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {citation.url}
                            </a>
                          ) : (
                            <span className="text-gray-600">
                              {citation.sourcePath || citation.route || 'Unknown source'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Routes */}
                {response.suggestedRoutes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Related Pages
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {response.suggestedRoutes.map((route, i) => (
                        <a
                          key={i}
                          href={route.route}
                          className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {route.title || route.route}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ticket Draft */}
                {response.ticketDraft && (
                  <div className="border border-orange-200 rounded-md overflow-hidden">
                    <button
                      onClick={() => setShowTicketDraft(!showTicketDraft)}
                      className="w-full px-3 py-2 bg-orange-50 hover:bg-orange-100 text-left text-sm font-medium text-orange-800 flex items-center justify-between transition-colors"
                    >
                      <span>Support Ticket Draft</span>
                      <ChevronIcon open={showTicketDraft} />
                    </button>
                    {showTicketDraft && (
                      <div className="p-3 bg-white space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">Title</div>
                          <div className="text-sm">{response.ticketDraft.title}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">Summary</div>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {response.ticketDraft.summary.map((s, i) => (
                              <li key={i} className="flex">
                                <span className="text-gray-400 mr-2">-</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">
                            Suggested Next Steps
                          </div>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {response.ticketDraft.suggestedNextInfo.map((s, i) => (
                              <li key={i} className="flex">
                                <span className="text-gray-400 mr-2">-</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          onClick={handleCopyTicketDraft}
                          className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!response && !error && !isLoading && (
              <div className="text-center text-gray-500 py-8">
                <QuestionIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Ask a question about the documentation</p>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isLoading ? <LoadingSpinner /> : 'Ask'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** Question mark icon */
function QuestionIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/** Close icon */
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** Chevron icon for expandable sections */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/** Loading spinner */
function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default VerbatimWidget;
