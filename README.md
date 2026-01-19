# Verbatim

Verbatim is a documentation assistant that answers natural-language questions using ingested content from developer documentation (MDX) and knowledge base exports (Markdown). It provides citation-backed answers, navigation suggestions, and ticket draft generation when confidence is low.

## Table of Contents

- [What is Verbatim?](#what-is-verbatim)
- [Key Concepts](#key-concepts)
- [Architecture](#architecture)
- [Features](#features)
- [Local Development](#local-development)
- [Pilot UI](#pilot-ui)
- [Widget](#widget)
- [Testing](#testing)
- [Cost and Usage Tracking](#cost-and-usage-tracking)
- [Project Status](#project-status)
- [Documentation](#documentation)

## What is Verbatim?

Verbatim ingests documentation content and answers questions with:

- **Always-on citations** - Every answer includes references to source content
- **Navigation guidance** - Suggested documentation routes for further reading
- **Ticket assistance** - When confidence is low, generates structured ticket drafts

It runs as a Next.js application with two surfaces:

1. **Pilot UI** (`/pilot/*`) - Internal web interface for ingestion, debugging, and operations
2. **Widget** - Embeddable chat component for documentation sites

## Key Concepts

### Workspaces

A workspace is a top-level container for documents. Each workspace isolates its content for retrieval and answering.

### Corpora

Content is organized into two corpora:

| Corpus | Source | Identity | Has Route? |
|--------|--------|----------|------------|
| `docs` | Next.js MDX pages (`**/page.mdx`) | Route-first: `docs:/guides/webhooks` | Yes |
| `kb` | Markdown exports (`**/*.md`) | Path-first: `kb:articles/faq.md` | No |

### Documents

A document represents one ingested file. Key fields:

- `canonicalId` - Stable identity for upserts (`docs:/route` or `kb:path`)
- `route` - Navigation target (docs only)
- `sourcePath` - Original file path for traceability
- `contentHash` - SHA-256 for change detection

### Chunks

Documents are split into retrieval units at H2 (`##`) boundaries. Each chunk stores:

- `content` - The text content
- `headingPath` - Breadcrumb for display (e.g., `["Guide", "Authentication"]`)
- `anchor` - GitHub-style slug for deep linking (docs only)

### Retrieval

Keyword-based retrieval with:

- Term matching with synonym expansion (`webhook` matches `callback`)
- Plural normalization (`webhooks` matches `webhook`)
- Quoted phrase support (`"merchant account"`)
- Proximity bonus for terms appearing close together
- Heading match bonus (2.5x weight vs content)
- Length normalization to avoid bias toward long chunks

### Answering

LLM-generated answers include:

- Concise response with inline citation markers `[1]`, `[2]`
- Citations with route/anchor for deep linking
- Confidence assessment (`high`, `medium`, `low`)
- Mode indicator (`answer` or `ticket_draft`)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     External Docs Site                       │
│  ┌─────────────────┐      ┌─────────────────────────────┐   │
│  │ VerbatimWidget  │─────▶│ /api/widget/answer (proxy)  │   │
│  └─────────────────┘      └─────────────────────────────┘   │
└──────────────────────────────────│──────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Verbatim Instance                       │
│                                                              │
│  /pilot/*          /api/ask         /api/answer              │
│  (Internal UI)     (Retrieval)      (LLM Answer)             │
│       │                 │                │                   │
│       ▼                 ▼                ▼                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Core Libraries                      │   │
│  │  ingestion/ │ retrieval/ │ answer/ │ llm/ │ cost/    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│                 ┌───────────────────┐                       │
│                 │ Postgres + pgvector│                       │
│                 └───────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Features

### Implemented

**Ingestion**
- Batch upload via UI or CLI script
- MDX parsing with frontmatter extraction
- Markdown parsing for KB content
- Route-first identity for docs (prevents `page.mdx` collisions)
- Content hashing for change detection
- Automatic chunk regeneration on content changes

**Chunking**
- H2-based chunk boundaries
- GitHub-style anchor generation for deep links
- Size splitting with configurable overlap (4000 chars max, 400 overlap)
- Heading path preservation for context

**Retrieval**
- Keyword-based scoring with weighted factors
- Synonym expansion (configurable synonym map)
- Plural normalization (English)
- Quoted phrase matching
- Proximity bonus for closely grouped terms
- Corpus-scoped search (`docs`, `kb`, or both)

**Answering**
- Multi-provider LLM support (Gemini, OpenAI, Anthropic)
- Confidence assessment with configurable thresholds
- Citation generation with route/anchor links
- Ticket draft generation on low confidence
- Defensive caps (timeout, max tokens, max chunks)

**Widget**
- Embeddable React component
- Proxy route pattern (keeps API keys server-side)
- Configurable defaults (workspace, corpus scope, provider)
- Workspace override via headers

**Operations**
- Rate limiting (in-memory, per-IP)
- Query event logging
- Cost estimation per request
- Usage dashboard with breakdowns

**UI**
- Dark mode with system preference detection
- Responsive sidebar navigation
- Document and chunk inspection
- Retrieval and answer debugging

## Local Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+ with [pgvector](https://github.com/pgvector/pgvector) extension
- pnpm, npm, or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd verbatim

# Install dependencies
npm install

# Navigate to the app
cd apps/verbatim

# Copy environment template
cp .env.example .env
```

### Environment Variables

Edit `.env` with your configuration:

```bash
# Required: PostgreSQL connection
DATABASE_URL="postgresql://user:password@localhost:5432/verbatim?schema=public"

# Required: At least one LLM provider API key
LLM_PROVIDER=gemini
GOOGLE_API_KEY="your-api-key"
# Or: OPENAI_API_KEY, ANTHROPIC_API_KEY

# Optional: Enable widget
NEXT_PUBLIC_WIDGET_ENABLED=1
WIDGET_DEFAULT_WORKSPACE_ID="your-workspace-id"
```

See [.env.example](./apps/verbatim/.env.example) for all options.

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate
```

### Running the Application

```bash
# Development server
npm run dev

# Production build
npm run build
npm run start
```

The app runs at `http://localhost:3000`.

### Ingesting Content

**Option 1: CLI script**

```bash
# Ingest docs corpus
npm run ingest -- <workspace-id> /path/to/docs --corpus docs

# Ingest KB corpus
npm run ingest -- <workspace-id> /path/to/kb --corpus kb
```

**Option 2: Pilot UI**

1. Navigate to `/pilot/workspaces` and create a workspace
2. Go to `/pilot/ingest`
3. Select workspace, corpus, and upload files

## Pilot UI

The Pilot UI (`/pilot/*`) provides internal tools for managing Verbatim:

| Route | Purpose |
|-------|---------|
| `/pilot` | Dashboard with quick links |
| `/pilot/workspaces` | Create/manage workspaces |
| `/pilot/ingest` | Batch upload documents |
| `/pilot/sources` | Browse ingested documents |
| `/pilot/sources/:id` | Inspect document and chunks |
| `/pilot/ask` | Test retrieval (no LLM) |
| `/pilot/answer` | Test full answer pipeline |
| `/pilot/widget` | Widget demo and testing |
| `/pilot/widget/install` | Installation snippets |
| `/pilot/usage` | Usage analytics dashboard |

## Widget

The widget is a React component that can be embedded in external documentation sites.

### Integration Pattern

```
Your Docs Site                         Verbatim Instance
┌─────────────────────────────┐       ┌─────────────────────┐
│ VerbatimWidget (client)     │──────▶│ /api/widget/answer  │
│         │                   │       └─────────────────────┘
│         ▼                   │                 │
│ /api/widget/answer (proxy)  │─────────────────┘
│ (server-side, has API key)  │
└─────────────────────────────┘
```

### Quick Start

1. Copy `src/components/widget/` to your project
2. Create proxy route at `/api/widget/answer`
3. Set environment variables:
   ```bash
   VERBATIM_BASE_URL=https://your-verbatim-instance.com
   NEXT_PUBLIC_WIDGET_ENABLED=1
   ```
4. Add to your layout:
   ```tsx
   import { VerbatimWidget } from '@/components/widget';

   <VerbatimWidget />
   ```

See [WIDGET_INTEGRATION.md](./apps/verbatim/WIDGET_INTEGRATION.md) for detailed instructions.

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests (requires database)
npm run test:integration
```

Test coverage includes:

- Chunking and anchor generation
- Retrieval scoring (synonyms, proximity, phrases)
- Confidence assessment
- Rate limiting
- Input validation
- Cost calculation
- Provider selection
- Theme system

## Cost and Usage Tracking

Verbatim tracks query events for analytics:

- Token usage per request (input/output)
- Cost estimation based on provider pricing
- Latency breakdown (retrieval vs LLM)
- Confidence and mode distribution

View usage at `/pilot/usage` or query the API:

- `GET /api/usage/summary?workspaceId=...&days=7`
- `GET /api/usage/events?workspaceId=...&limit=100`

Cost tracking uses configurable pricing tables per model. See [pricing.ts](./apps/verbatim/src/lib/cost/pricing.ts).

## Project Status

Verbatim is in **v1 pilot** stage, running behind Cloudflare Tunnel for internal testing.

### Current State

- Keyword-based retrieval (vector search schema exists but not yet active)
- Three LLM providers supported (Gemini, OpenAI, Anthropic)
- Widget integration ready for docs site embedding
- Usage tracking and cost estimation operational
- Rate limiting in-memory only (no Redis)

### Not Yet Implemented

- Vector/embedding-based retrieval
- SSO/authentication (relies on Cloudflare Tunnel)
- Freshdesk ticket submission (draft generation only)
- Conversation memory beyond single session
- Per-user rate limiting

### Roadmap

See [ARCHITECTURE.md Section 16](./ARCHITECTURE.md#16-roadmap-post-v1) for planned enhancements.

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Data model, ingestion rules, chunking spec, API contracts |
| [TECH_STACK.md](./TECH_STACK.md) | Technology choices, tradeoffs, upgrade paths |
| [OPERATIONS.md](./OPERATIONS.md) | Day-to-day runbook, ingestion workflows, debugging |
| [WIDGET_INTEGRATION.md](./apps/verbatim/WIDGET_INTEGRATION.md) | Embedding the widget in external sites |

## API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ask` | POST | Retrieval-only (no LLM) |
| `/api/answer` | POST | Full answer with LLM |
| `/api/ingest/batch` | POST | Batch document upload |
| `/api/ticket-draft` | POST | Generate ticket draft |
| `/api/workspaces` | GET/POST | List/create workspaces |
| `/api/workspaces/:id` | GET/DELETE | Get/delete workspace |
| `/api/workspaces/:id/documents` | GET | List documents |
| `/api/documents/:id` | GET/DELETE | Get/delete document |

### Widget Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/widget/answer` | POST | Widget answer proxy |
| `/api/widget/config` | GET | Public widget config |

### Usage Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/usage/summary` | GET | Aggregated usage stats |
| `/api/usage/events` | GET | Query event log |

## License

Internal use only. Not for distribution.
