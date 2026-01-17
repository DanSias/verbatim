'use client';

/**
 * Widget Demo Page
 *
 * Demonstrates the documentation assistant widget that will
 * eventually be embedded in the docs site.
 *
 * Includes workspace override for pilot testing different workspaces.
 */

import { useState, useEffect, FormEvent } from 'react';
import { VerbatimWidget } from '@/components/widget';

/** LocalStorage key for persisting workspace override */
const WORKSPACE_OVERRIDE_KEY = 'verbatim-pilot-workspace-override';

/** Response type for inline testing form */
interface WidgetResponse {
  answer?: string;
  citations?: Array<{ index: number; url?: string; sourcePath?: string }>;
  suggestedRoutes?: Array<{ route: string; title: string | null }>;
  confidence?: string;
  mode?: string;
  error?: string;
  code?: string;
}

export default function WidgetDemoPage() {
  // Workspace override state
  const [workspaceOverride, setWorkspaceOverride] = useState('');
  const [savedWorkspace, setSavedWorkspace] = useState('');

  // Load saved workspace on mount
  useEffect(() => {
    const saved = localStorage.getItem(WORKSPACE_OVERRIDE_KEY) || '';
    setWorkspaceOverride(saved);
    setSavedWorkspace(saved);
  }, []);

  // Save workspace to localStorage
  const handleSaveWorkspace = () => {
    const trimmed = workspaceOverride.trim();
    localStorage.setItem(WORKSPACE_OVERRIDE_KEY, trimmed);
    setSavedWorkspace(trimmed);
  };

  // Clear workspace override
  const handleClearWorkspace = () => {
    setWorkspaceOverride('');
    setSavedWorkspace('');
    localStorage.removeItem(WORKSPACE_OVERRIDE_KEY);
  };

  // Build request headers for widget
  const widgetHeaders: Record<string, string> = {};
  if (savedWorkspace) {
    widgetHeaders['x-verbatim-workspace-id'] = savedWorkspace;
  }

  // API test form state
  const [testQuestion, setTestQuestion] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<WidgetResponse | null>(null);

  const handleTestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!testQuestion.trim() || testLoading) return;

    setTestLoading(true);
    setTestResponse(null);

    try {
      const res = await fetch('/api/widget/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...widgetHeaders,
        },
        body: JSON.stringify({ question: testQuestion.trim() }),
      });

      const data = await res.json();
      setTestResponse(data);
    } catch (err) {
      setTestResponse({
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const isWidgetEnabled = process.env.NEXT_PUBLIC_WIDGET_ENABLED === '1';

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Widget Demo</h1>
      <p className="text-gray-600 mb-8">
        This page demonstrates the documentation assistant widget that will be embedded in the docs
        site. The widget communicates via <code className="bg-gray-100 px-1 rounded">/api/widget/answer</code>,
        which proxies requests to the internal answer API with server-side configuration.
      </p>

      {/* Widget Status */}
      <div className="mb-8 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Widget Status</h2>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isWidgetEnabled
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {isWidgetEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <span className="text-sm text-gray-600">
            {isWidgetEnabled
              ? 'Look for the "Ask Docs" button in the bottom-right corner.'
              : 'Set NEXT_PUBLIC_WIDGET_ENABLED=1 to enable the widget.'}
          </span>
        </div>
      </div>

      {/* Workspace Override (Pilot Testing) */}
      <div className="mb-8 p-4 rounded-lg border border-purple-200 bg-purple-50">
        <h2 className="text-lg font-semibold text-purple-900 mb-2">Workspace Override</h2>
        <p className="text-sm text-purple-700 mb-3">
          Override the workspace ID for testing. This sends{' '}
          <code className="bg-purple-100 px-1 rounded">x-verbatim-workspace-id</code> header with requests.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={workspaceOverride}
            onChange={(e) => setWorkspaceOverride(e.target.value)}
            placeholder="Enter workspace ID to override..."
            className="flex-1 px-3 py-2 border border-purple-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
          <button
            onClick={handleSaveWorkspace}
            disabled={workspaceOverride === savedWorkspace}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-md transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleClearWorkspace}
            disabled={!savedWorkspace && !workspaceOverride}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
        {savedWorkspace && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-200 text-purple-900">
              Active: {savedWorkspace}
            </span>
          </div>
        )}
      </div>

      {/* Architecture Overview */}
      <div className="mb-8 p-4 rounded-lg border border-blue-200 bg-blue-50">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Architecture</h2>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Current (Verbatim demo):</strong>
          </p>
          <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">
{`Browser → /api/widget/answer → /api/answer (same server)`}
          </pre>
          <p>
            <strong>Future (Docs site):</strong>
          </p>
          <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">
{`Browser → /api/widget/answer → VERBATIM_BASE_URL/api/answer (external)`}
          </pre>
          <p className="text-blue-700">
            The widget component and proxy route are designed to be copied to the docs repo with
            minimal changes.
          </p>
        </div>
      </div>

      {/* Inline Test Form */}
      <div className="mb-8 p-4 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Test Form</h2>
        <p className="text-sm text-gray-600 mb-4">
          Test the <code className="bg-gray-100 px-1 rounded">/api/widget/answer</code> endpoint
          directly:
        </p>

        <form onSubmit={handleTestSubmit} className="space-y-4">
          <div>
            <label htmlFor="test-question" className="block text-sm font-medium text-gray-700 mb-1">
              Question
            </label>
            <input
              id="test-question"
              type="text"
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              placeholder="How do I authenticate API requests?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={testLoading}
            />
          </div>
          <button
            type="submit"
            disabled={testLoading || !testQuestion.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
          >
            {testLoading ? 'Sending...' : 'Send Request'}
          </button>
        </form>

        {/* Test Response */}
        {testResponse && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Response:</h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-md text-xs overflow-x-auto max-h-96">
              {JSON.stringify(testResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Environment Variables Reference */}
      <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Environment Variables</h2>
        <div className="text-sm text-gray-700 space-y-2">
          <p>Configure the widget with these environment variables:</p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`# Required
WIDGET_DEFAULT_WORKSPACE_ID=your-workspace-id

# Optional (defaults shown)
WIDGET_DEFAULT_CORPUS_SCOPE=docs,kb
WIDGET_DEFAULT_MIN_CONFIDENCE=medium
WIDGET_DEFAULT_PROVIDER=gemini

# Enable widget in UI
NEXT_PUBLIC_WIDGET_ENABLED=1`}
          </pre>
        </div>
      </div>

      {/* Widget Component */}
      <VerbatimWidget requestHeaders={widgetHeaders} />
    </div>
  );
}
