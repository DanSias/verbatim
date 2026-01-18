# Widget Integration Guide

This guide explains how to embed the Verbatim documentation widget in external sites (e.g., your docs repository).

## Overview

The Verbatim widget provides an AI-powered Q&A interface that can be embedded in any Next.js application. It queries your ingested documentation and knowledge base to provide accurate, citation-backed answers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Your Docs Site                                                  │
│ ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│ │ VerbatimWidget      │───▶│ /api/widget/answer (proxy route) │ │
│ │ (React component)   │    │ (server-side, keeps API key safe)│ │
│ └─────────────────────┘    └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────┐
                          │ Verbatim Instance           │
                          │ POST /api/answer            │
                          └─────────────────────────────┘
```

## Quick Start

### 1. Copy the Widget Component

Copy the `src/components/widget/` directory to your project:

```
src/
  components/
    widget/
      index.tsx      # Main widget component
      chat.tsx       # Chat interface
      types.ts       # TypeScript types
```

### 2. Create the Proxy Route

Create `app/api/widget/answer/route.ts` in your docs repo:

```typescript
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
      headers['Authorization'] = `Bearer ${VERBATIM_API_KEY}`;
    }

    const response = await fetch(`${VERBATIM_BASE_URL}/api/widget/answer`, {
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
}
```

### 3. Configure Environment Variables

Add to your `.env`:

```bash
# Required: URL of your Verbatim instance
VERBATIM_BASE_URL=https://your-verbatim-instance.com

# Optional: API key if authentication is required
VERBATIM_API_KEY=your-api-key

# Required: Enable the widget UI
NEXT_PUBLIC_WIDGET_ENABLED=1
```

### 4. Add the Widget to Your Layout

**App Router (`app/layout.tsx`):**

```tsx
import { VerbatimWidget } from '@/components/widget';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VerbatimWidget />
      </body>
    </html>
  );
}
```

**Pages Router (`pages/_app.tsx`):**

```tsx
import type { AppProps } from 'next/app';
import { VerbatimWidget } from '@/components/widget';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <VerbatimWidget />
    </>
  );
}
```

## Configuration Options

### Environment Variables

| Variable | Side | Required | Description |
|----------|------|----------|-------------|
| `VERBATIM_BASE_URL` | Server | Yes | URL of your Verbatim instance |
| `VERBATIM_API_KEY` | Server | No | API key for authenticated requests |
| `NEXT_PUBLIC_WIDGET_ENABLED` | Client | Yes | Set to `"1"` to show the widget |

### Widget Props

The `VerbatimWidget` component accepts optional props:

```tsx
<VerbatimWidget
  // Custom headers sent with each request
  requestHeaders={{
    'x-verbatim-workspace-id': 'your-workspace-id'
  }}
/>
```

### Workspace Override

You can override the default workspace per-request by passing custom headers:

```tsx
<VerbatimWidget
  requestHeaders={{
    'x-verbatim-workspace-id': 'your-workspace-id'
  }}
/>
```

Header priority: `x-verbatim-workspace-id` header > `WIDGET_DEFAULT_WORKSPACE_ID` env var.

## Server-Side Configuration

When running in the Verbatim instance itself (not as an external embed), additional server-side configuration is available:

| Variable | Description |
|----------|-------------|
| `WIDGET_UPSTREAM_MODE` | `local` (default) or `remote` |
| `WIDGET_DEFAULT_WORKSPACE_ID` | Default workspace for widget queries |
| `WIDGET_DEFAULT_CORPUS_SCOPE` | Comma-separated: `docs`, `kb`, or `docs,kb` |
| `WIDGET_DEFAULT_MIN_CONFIDENCE` | `low`, `medium`, or `high` |
| `WIDGET_DEFAULT_PROVIDER` | `gemini`, `openai`, or `anthropic` |

## API Reference

### POST /api/widget/answer

**Request Body:**

```json
{
  "question": "How do I configure authentication?",
  "topK": 6,
  "corpusScope": ["docs", "kb"],
  "minConfidence": "medium",
  "provider": "gemini"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The user's question (max 2000 chars) |
| `topK` | number | No | Number of chunks to retrieve (1-10, default 6) |
| `corpusScope` | string[] | No | Sources to search: `["docs"]`, `["kb"]`, or `["docs", "kb"]` |
| `minConfidence` | string | No | Minimum confidence level: `low`, `medium`, `high` |
| `provider` | string | No | LLM provider: `gemini`, `openai`, `anthropic` |

**Response (Success):**

```json
{
  "answer": "To configure authentication, you need to...",
  "citations": [
    {
      "index": 1,
      "corpus": "docs",
      "route": "/guides/authentication",
      "anchor": "configuration",
      "title": "Authentication Guide"
    }
  ],
  "confidence": "high",
  "mode": "answer",
  "debug": {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "chunksUsed": 4,
    "usage": {
      "inputTokens": 1234,
      "outputTokens": 567
    }
  }
}
```

**Response (Error):**

```json
{
  "error": "Description of error",
  "code": "ERROR_CODE",
  "details": {}
}
```

### GET /api/widget/config

Returns public widget configuration (no secrets exposed).

**Response:**

```json
{
  "enabled": true,
  "upstreamMode": "local",
  "verbatimBaseUrlSet": true,
  "verbatimApiKeySet": false,
  "defaultWorkspaceId": "ws_abc123",
  "defaultCorpusScope": ["docs", "kb"],
  "defaultMinConfidence": "medium",
  "defaultProvider": "gemini"
}
```

## Static HTML / Non-Next.js Sites

The widget is a React component requiring a JavaScript runtime. For static HTML sites:

1. **iframe embed (Recommended):** Host the widget in a separate Next.js app or use the Verbatim instance's widget page directly via iframe.

2. **Standalone bundle:** Build the widget as a standalone JS bundle (requires additional build tooling not included).

3. **API-only:** Call `/api/widget/answer` directly and build your own UI. The endpoint accepts and returns JSON.

## Troubleshooting

### Widget doesn't appear

1. Check that `NEXT_PUBLIC_WIDGET_ENABLED=1` is set
2. Verify the widget component is imported and rendered in your layout
3. Check browser console for JavaScript errors

### "VERBATIM_BASE_URL not configured" error

The proxy route requires `VERBATIM_BASE_URL` to be set in your environment. This should point to your Verbatim instance (e.g., `https://verbatim.yourcompany.com`).

### CORS errors

The widget should always go through the proxy route (`/api/widget/answer`) rather than calling Verbatim directly. The proxy route runs server-side and avoids CORS issues.

### "workspaceId is required" error

Either:
1. Set `WIDGET_DEFAULT_WORKSPACE_ID` on the Verbatim server
2. Pass the workspace ID via header in your widget: `requestHeaders={{ 'x-verbatim-workspace-id': 'your-id' }}`

## Security Considerations

1. **API keys stay server-side:** The proxy route keeps `VERBATIM_API_KEY` on the server. Never expose it to the client.

2. **Rate limiting:** Consider adding rate limiting to your proxy route to protect your Verbatim instance.

3. **Input validation:** The widget and API validate inputs, but consider additional validation in your proxy if needed.

## Resources

- [Widget Demo](/pilot/widget) - Test the widget in action
- [Widget Install Page](/pilot/widget/install) - Copy-paste snippets and current config
