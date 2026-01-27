'use client';

/**
 * Recent Queries Component
 *
 * Displays recent query runs for the active workspace.
 * Shows last 10 queries with expandable citation details.
 */

import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface QueryRunResult {
  chunkId: string;
  score: number;
  citationUrl?: string;
  documentId?: string;
  documentTitle?: string;
  anchor?: string | null;
}

interface QueryRun {
  id: string;
  workspaceId: string;
  question: string;
  scope: string;
  topK: number;
  retrievalMode: string | null;
  resultsJson: QueryRunResult[];
  createdAt: string;
}

interface RecentQueriesProps {
  workspaceId: string | null;
}

export function RecentQueries({ workspaceId }: RecentQueriesProps) {
  const [runs, setRuns] = useState<QueryRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setRuns([]);
      return;
    }

    const fetchRuns = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/query-runs?workspaceId=${encodeURIComponent(workspaceId)}&limit=10`);

        if (!response.ok) {
          throw new Error('Failed to fetch query runs');
        }

        const data = await response.json();
        setRuns(data.runs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recent queries');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [workspaceId]);

  if (!workspaceId) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Queries</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Queries</h3>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Queries</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">No queries yet. Try asking a question above.</p>
      </div>
    );
  }

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1d ago';
    return `${diffDays}d ago`;
  };

  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Queries</h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {runs.map((run) => {
          const isExpanded = expandedId === run.id;

          return (
            <div key={run.id} className="p-4">
              <button
                onClick={() => setExpandedId(isExpanded ? null : run.id)}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded -m-1 p-1"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-gray-400 dark:text-gray-500">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(run.createdAt)}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-medium uppercase">
                        {run.scope}
                      </span>
                      <span className="text-gray-400 dark:text-gray-600">•</span>
                      <span>Top {run.topK}</span>
                      {run.retrievalMode && (
                        <>
                          <span className="text-gray-400 dark:text-gray-600">•</span>
                          <span className="capitalize">{run.retrievalMode}</span>
                        </>
                      )}
                    </div>

                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {truncate(run.question, 100)}
                    </p>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Citations ({run.resultsJson.length})
                        </h4>
                        <ul className="space-y-1.5">
                          {run.resultsJson.map((result, idx) => (
                            <li key={result.chunkId} className="text-xs">
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400 shrink-0">
                                  [{idx + 1}]
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-gray-700 dark:text-gray-300">
                                    Score: {result.score.toFixed(2)}
                                  </span>
                                  {result.citationUrl && (
                                    <div className="mt-0.5 font-mono text-blue-600 dark:text-blue-400 truncate">
                                      {result.citationUrl}
                                    </div>
                                  )}
                                  {result.anchor && (
                                    <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                                      #{result.anchor}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
