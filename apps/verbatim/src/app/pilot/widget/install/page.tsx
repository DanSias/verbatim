'use client';

/**
 * Widget Install Page
 *
 * Provides embed snippets and installation instructions for
 * integrating the Verbatim widget into external sites.
 */

import { useState, useEffect } from 'react';

/** Widget config from API */
interface WidgetConfig {
  enabled: boolean;
  upstreamMode: 'local' | 'remote';
  verbatimBaseUrlSet: boolean;
  verbatimApiKeySet: boolean;
  defaultWorkspaceId: string | null;
  defaultCorpusScope: string[] | null;
  defaultMinConfidence: string | null;
  defaultProvider: string | null;
}

/** Code snippet for Next.js App Router */
const APP_ROUTER_SNIPPET = `// app/layout.tsx or wherever you want the widget
import { VerbatimWidget } from '@/components/widget';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Widget renders in bottom-right corner */}
        <VerbatimWidget />
      </body>
    </html>
  );
}`;

/** Code snippet for Next.js Pages Router */
const PAGES_ROUTER_SNIPPET = `// pages/_app.tsx
import type { AppProps } from 'next/app';
import { VerbatimWidget } from '@/components/widget';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {/* Widget renders in bottom-right corner */}
      <VerbatimWidget />
    </>
  );
}`;

/** Proxy route snippet for docs repo */
const PROXY_ROUTE_SNIPPET = `// app/api/widget/answer/route.ts (in docs repo)
import { NextRequest, NextResponse } from 'next/server';

const VERBATIM_BASE_URL = process.env.VERBATIM_BASE_URL;
const VERBATIM_API_KEY = process.env.VERBATIM_API_KEY;

export async function POST(request: NextRequest) {
  if (!VERBATIM_BASE_URL) {
    return NextResponse.json(
      { error: 'VERBATIM_BASE_URL not configured', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (VERBATIM_API_KEY) {
      headers['Authorization'] = \`Bearer \${VERBATIM_API_KEY}\`;
    }

    const response = await fetch(\`\${VERBATIM_BASE_URL}/api/widget/answer\`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy error', code: 'PROXY_ERROR' },
      { status: 502 }
    );
  }
}`;

/** Workspace override snippet */
const WORKSPACE_OVERRIDE_SNIPPET = `// Pass custom headers to the widget
<VerbatimWidget
  requestHeaders={{
    'x-verbatim-workspace-id': 'your-workspace-id'
  }}
/>`;

/** Environment variables for docs repo */
const ENV_VARS_SNIPPET = `# Required for widget proxy
VERBATIM_BASE_URL=https://your-verbatim-instance.com
VERBATIM_API_KEY=your-api-key  # Optional, if auth required

# Widget UI toggle
NEXT_PUBLIC_WIDGET_ENABLED=1`;

export default function WidgetInstallPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/widget/config')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  const CopyButton = ({ text, section }: { text: string; section: string }) => (
    <button
      onClick={() => copyToClipboard(text, section)}
      className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
    >
      {copiedSection === section ? 'Copied!' : 'Copy'}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Widget Installation</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Instructions for embedding the Verbatim documentation widget in your site.
      </p>

      {/* Current Config Preview */}
      <div className="mb-8 p-4 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">Current Configuration</h2>
        {loading ? (
          <div className="text-blue-700 dark:text-blue-300">Loading configuration...</div>
        ) : config ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-blue-700 dark:text-blue-300">Widget Enabled:</div>
            <div className={config.enabled ? 'text-green-700 dark:text-green-400 font-medium' : 'text-red-700 dark:text-red-400'}>
              {config.enabled ? 'Yes' : 'No'}
            </div>

            <div className="text-blue-700 dark:text-blue-300">Upstream Mode:</div>
            <div className="text-blue-900 dark:text-blue-100 font-medium">{config.upstreamMode}</div>

            <div className="text-blue-700 dark:text-blue-300">VERBATIM_BASE_URL:</div>
            <div className={config.verbatimBaseUrlSet ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
              {config.verbatimBaseUrlSet ? 'Set' : 'Not set'}
            </div>

            <div className="text-blue-700 dark:text-blue-300">VERBATIM_API_KEY:</div>
            <div className={config.verbatimApiKeySet ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
              {config.verbatimApiKeySet ? 'Set' : 'Not set'}
            </div>

            <div className="text-blue-700 dark:text-blue-300">Default Workspace ID:</div>
            <div className="text-blue-900 dark:text-blue-100 font-mono text-xs">
              {config.defaultWorkspaceId || <span className="text-gray-500 dark:text-gray-400">Not set</span>}
            </div>

            <div className="text-blue-700 dark:text-blue-300">Default Corpus Scope:</div>
            <div className="text-blue-900 dark:text-blue-100">
              {config.defaultCorpusScope?.join(', ') || <span className="text-gray-500 dark:text-gray-400">Not set</span>}
            </div>

            <div className="text-blue-700 dark:text-blue-300">Default Min Confidence:</div>
            <div className="text-blue-900 dark:text-blue-100">
              {config.defaultMinConfidence || <span className="text-gray-500 dark:text-gray-400">Not set</span>}
            </div>

            <div className="text-blue-700 dark:text-blue-300">Default Provider:</div>
            <div className="text-blue-900 dark:text-blue-100">
              {config.defaultProvider || <span className="text-gray-500 dark:text-gray-400">Not set</span>}
            </div>
          </div>
        ) : (
          <div className="text-red-700 dark:text-red-400">Failed to load configuration</div>
        )}
      </div>

      {/* Next.js App Router */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Next.js (App Router)
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          For Next.js 13+ with the App Router, add the widget to your root layout:
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
            <code>{APP_ROUTER_SNIPPET}</code>
          </pre>
          <CopyButton text={APP_ROUTER_SNIPPET} section="app-router" />
        </div>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Required Setup</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>
              Copy <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">src/components/widget/</code> to your project
            </li>
            <li>
              Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">NEXT_PUBLIC_WIDGET_ENABLED=1</code> in your{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code>
            </li>
            <li>Create a proxy route (see Proxy Route section below)</li>
          </ul>
        </div>
      </section>

      {/* Next.js Pages Router */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Next.js (Pages Router)
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          For Next.js with the Pages Router, add the widget to your _app.tsx:
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
            <code>{PAGES_ROUTER_SNIPPET}</code>
          </pre>
          <CopyButton text={PAGES_ROUTER_SNIPPET} section="pages-router" />
        </div>
      </section>

      {/* Proxy Route */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Proxy Route (Required for External Sites)
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          When embedding in an external site (like your docs repo), you need a server-side proxy route
          to forward requests to Verbatim. This avoids CORS issues and keeps your API key secure.
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
            <code>{PROXY_ROUTE_SNIPPET}</code>
          </pre>
          <CopyButton text={PROXY_ROUTE_SNIPPET} section="proxy-route" />
        </div>
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Important Notes</h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
            <li>The proxy runs server-side, keeping your API key secure</li>
            <li>Always return JSON responses (never HTML errors)</li>
            <li>Consider adding rate limiting to protect your Verbatim instance</li>
          </ul>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Environment Variables
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          Add these to your docs repo&apos;s <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env</code> file:
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
            <code>{ENV_VARS_SNIPPET}</code>
          </pre>
          <CopyButton text={ENV_VARS_SNIPPET} section="env-vars" />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Variable</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Side</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">VERBATIM_BASE_URL</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Server</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">URL of your Verbatim instance</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">VERBATIM_API_KEY</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Server</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">API key for authenticated requests (optional)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">NEXT_PUBLIC_WIDGET_ENABLED</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Client</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Set to &quot;1&quot; to show the widget</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Workspace Override */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Workspace Override
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          You can override the workspace ID per-request by passing custom headers to the widget.
          This is useful for testing different workspaces or multi-tenant setups.
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
            <code>{WORKSPACE_OVERRIDE_SNIPPET}</code>
          </pre>
          <CopyButton text={WORKSPACE_OVERRIDE_SNIPPET} section="workspace-override" />
        </div>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Header Priority</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">x-verbatim-workspace-id</code> header takes
            precedence over the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">WIDGET_DEFAULT_WORKSPACE_ID</code>{' '}
            environment variable on the server.
          </p>
        </div>
      </section>

      {/* Static HTML / SSR */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Server-Rendered Docs / Static HTML
        </h2>
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/40">
          <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">Limitations</h3>
          <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
            The widget is a React component and requires a JavaScript runtime. For static HTML sites:
          </p>
          <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-2 list-disc list-inside">
            <li>
              <strong>Recommended:</strong> Use an iframe to embed a hosted widget page from your
              Verbatim instance or a separate Next.js app.
            </li>
            <li>
              <strong>Alternative:</strong> Build the widget as a standalone bundle (requires additional
              build tooling not included in this repo).
            </li>
            <li>
              <strong>API-only:</strong> Call the API directly and build your own UI. The{' '}
              <code className="bg-orange-100 dark:bg-orange-900/40 px-1 rounded">/api/widget/answer</code> endpoint accepts
              JSON and returns JSON.
            </li>
          </ul>
        </div>
      </section>

      {/* Links */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Resources</h2>
        <ul className="space-y-2">
          <li>
            <a
              href="/pilot/widget"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Widget Demo
            </a>
            <span className="text-gray-500 dark:text-gray-400"> - Test the widget in action</span>
          </li>
          <li>
            <span className="text-gray-700 dark:text-gray-300">WIDGET_INTEGRATION.md</span>
            <span className="text-gray-500 dark:text-gray-400"> - Full integration guide (in repo root)</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
