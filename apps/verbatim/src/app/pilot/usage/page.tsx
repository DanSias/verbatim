'use client';

/**
 * Pilot Usage Page
 *
 * Dashboard for viewing usage statistics and query events.
 * Shows summaries, cost estimates, and recent queries.
 */

import { useState, useEffect, useCallback } from 'react';

/** Time window options */
type TimeWindow = '24h' | '7d';

/** Summary response from API */
interface UsageSummary {
  window: string;
  startDate: string;
  endDate: string;
  totalRequests: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
  errorCount: number;
  byConfidence: Record<string, number>;
  byMode: Record<string, number>;
  byProvider: Record<string, number>;
  byWorkspace: Record<string, { name?: string; count: number }>;
  tokenStats: { totalInput: number; totalOutput: number };
}

/** Event from API */
interface UsageEvent {
  id: string;
  createdAt: string;
  workspaceId: string;
  workspaceName: string | null;
  source: string;
  endpoint: string;
  provider: string;
  model: string;
  mode: string;
  confidence: string;
  corpusScope: string;
  topK: number;
  questionPreview: string;
  questionLength: number;
  latencyMs: number;
  retrievalLatencyMs: number | null;
  llmLatencyMs: number | null;
  chunksUsed: number | null;
  citations: object[] | null;
  suggestedRoutes: object[] | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Events response from API */
interface EventsResponse {
  window: string;
  total: number;
  limit: number;
  offset: number;
  events: UsageEvent[];
}

/** Workspace from API */
interface Workspace {
  id: string;
  name: string;
}

/** Confidence badge colors */
const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
};

/** Mode badge colors */
const modeColors: Record<string, string> = {
  answer: 'bg-blue-100 text-blue-800',
  ticket_draft: 'bg-orange-100 text-orange-800',
};

export default function UsagePage() {
  const [window, setWindow] = useState<TimeWindow>('24h');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Fetch workspaces for filter dropdown
  useEffect(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces);
        }
      })
      .catch(() => {
        // Ignore errors fetching workspaces
      });
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ window });
      if (workspaceId) {
        params.set('workspaceId', workspaceId);
      }

      // Fetch summary and events in parallel
      const [summaryRes, eventsRes] = await Promise.all([
        fetch(`/api/usage/summary?${params}`),
        fetch(`/api/usage/events?${params}&limit=50`),
      ]);

      if (!summaryRes.ok) {
        const err = await summaryRes.json();
        throw new Error(err.error || 'Failed to fetch summary');
      }

      if (!eventsRes.ok) {
        const err = await eventsRes.json();
        throw new Error(err.error || 'Failed to fetch events');
      }

      const summaryData = await summaryRes.json();
      const eventsData: EventsResponse = await eventsRes.json();

      setSummary(summaryData);
      setEvents(eventsData.events);
      setEventsTotal(eventsData.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [window, workspaceId]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format currency
  const formatCost = (cost: number | null): string => {
    if (cost === null) return '-';
    if (cost < 0.0001) return '< $0.0001';
    return `$${cost.toFixed(4)}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  // Toggle event details
  const toggleEventDetails = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Usage Dashboard</h1>
      <p className="text-gray-600 mb-6">
        View query statistics, token usage, and estimated costs.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Time window selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Window:</label>
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value as TimeWindow)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        {/* Workspace filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Workspace:</label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Total Requests</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalRequests}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Estimated Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCost(summary.estimatedCostUsd)}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Avg Latency</div>
            <div className="text-2xl font-bold text-gray-900">{summary.avgLatencyMs}ms</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Error Rate</div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalRequests > 0
                ? `${((summary.errorCount / summary.totalRequests) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* By Confidence */}
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Confidence</h3>
            <div className="space-y-2">
              {Object.entries(summary.byConfidence).map(([level, count]) => (
                <div key={level} className="flex justify-between items-center">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${confidenceColors[level] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {level}
                  </span>
                  <span className="text-sm text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Mode */}
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Mode</h3>
            <div className="space-y-2">
              {Object.entries(summary.byMode).map(([mode, count]) => (
                <div key={mode} className="flex justify-between items-center">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${modeColors[mode] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {mode.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Provider */}
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Provider</h3>
            <div className="space-y-2">
              {Object.entries(summary.byProvider).map(([provider, count]) => (
                <div key={provider} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{provider}</span>
                  <span className="text-sm text-gray-700">{count}</span>
                </div>
              ))}
              {Object.keys(summary.byProvider).length === 0 && (
                <div className="text-sm text-gray-500">No data</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token Stats */}
      {summary && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Token Usage</h3>
          <div className="flex gap-8">
            <div>
              <span className="text-sm text-gray-500">Input Tokens: </span>
              <span className="text-sm font-medium text-gray-900">
                {summary.tokenStats.totalInput.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-500">Output Tokens: </span>
              <span className="text-sm font-medium text-gray-900">
                {summary.tokenStats.totalOutput.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">
            Recent Events ({eventsTotal} total)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workspace
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider/Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Question
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <>
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleEventDetails(event.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {event.workspaceName || event.workspaceId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      <div>{event.provider}</div>
                      <div className="text-xs text-gray-400">{event.model}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${confidenceColors[event.confidence] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {event.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${modeColors[event.mode] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {event.mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {event.totalTokens ?? '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatCost(event.estimatedCostUsd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                      {event.errorCode ? (
                        <span className="text-red-600">[{event.errorCode}]</span>
                      ) : (
                        event.questionPreview
                      )}
                    </td>
                  </tr>
                  {expandedEventId === event.id && (
                    <tr key={`${event.id}-details`}>
                      <td colSpan={8} className="px-4 py-3 bg-gray-50">
                        <pre className="text-xs text-gray-700 overflow-x-auto max-h-64">
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No events found for this time window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
