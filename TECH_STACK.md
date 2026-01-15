# TECH_STACK.md — Verbatim (Recommended v1 Stack + Upgrade Path)

This document describes the recommended tools for Verbatim at each layer of the stack. It is **implementation guidance**, not the source of architectural truth (see `ARCHITECTURE.md`).

---

## 1) Guiding Principles

* **Ship v1 safely behind Cloudflare Tunnel** with minimal complexity.
* **Separate concerns**: docs UI concerns stay in the docs app; Verbatim owns ingestion/retrieval/answers.
* Prefer **boring, well-supported** tools that are easy to operate and hire for.
* Design for an easy upgrade to **SSO, multi-tenant access, and production hardening**.

---

## 2) Frontend Layer

### 2.1 Developer Docs Site (Host + UI)

**Recommended:** Next.js (App Router) + MDX (existing)

* Rationale: this is the existing developer documentation site.
* Verbatim **does not** use MDX for its own UI. MDX only matters as an **ingestion input format** (docs pages are authored in MDX, imported into Verbatim, then normalized to text + chunks).
* Owns: widget placement logic, session integration, route context, and any future SSO session.

**UI library (optional):** Tailwind CSS / existing design system

* Keep widget styling consistent with docs.

### 2.2 Embedded Widget

**Recommended:** React component shipped within the docs site

* Implement as a client component that calls a **docs-site server proxy**.

**Why a proxy?**

* Keeps secrets off the client.
* Gives you a stable integration surface now, and a clean swap to SSO later.

**Suggested integration pattern:**

* Widget → `POST /api/verbatim/ask` (docs site)
* Docs site → `POST /ask` (Verbatim API)

---

## 3) Backend / API Layer

### 3.1 Verbatim API Service

**Recommended (v1):** Next.js (Node runtime) or lightweight Node service

* Verbatim can be implemented as a standard React/Next app (internal UI) plus API routes, but **its UI should be conventional React components**, not MDX.
* Ensure runtime is **nodejs** (not edge) for file uploads and embeddings.

**Alternative (later):** Fastify / Express / NestJS

* Consider if you want clearer separation from any Next.js UI.

### 3.2 Verbatim Internal UI

**Recommended:** conventional React UI (design-system driven)

* Purpose: ingestion, inspection, debugging, and admin operations.
* Content displayed in the UI is driven by database records (documents/chunks/citations), not by MDX pages.

### 3.3 API Design

**Recommended:** JSON-over-HTTP + typed contracts

* Define request/response types in a shared package (e.g., `packages/contracts`).
* Add an OpenAPI spec later; optional in v1.

**Key endpoints (v1):**

* `POST /ask`
* `POST /ingest/batch`
* `POST /ticket-draft`
* `POST /tickets` (feature-flagged)

### 3.4 Session Memory

**Recommended (v1):** Server-side conversation store

* Store recent turns keyed by `conversationId`.

**Storage choice:**

* v1: Postgres table `Conversation` + `Message` (simple)
* later: Redis for lower latency / TTL

---

## 4) Ingestion & Processing Layer

### 4.1 File Uploads

**Recommended:** multipart/form-data uploads to Verbatim

* Batch uploads (e.g., 10 files per request)
* Include `workspaceId` and `corpus` (`docs` | `kb`)

### 4.2 Parsing

**Recommended:**

* `mdast`/`remark` pipeline for Markdown/MDX normalization
* Strip/normalize MDX components into text
* Preserve headings + code blocks

Practical packages:

* `remark` + `remark-parse`
* `remark-mdx`
* `unist-util-visit`

### 4.3 Slugging for Anchors

**Recommended:** `github-slugger`

* Must match docs-site anchor behavior (GitHub-style + duplicate handling).

### 4.4 Chunking

**Recommended:** corpus-aware H2 chunking (per `ARCHITECTURE.md`)

* Docs: chunk boundary = H2; compute `anchor`
* KB: H2 boundary by default

### 4.5 Background Jobs (Optional but Useful)

**v1 can be synchronous**, but if ingestion grows:

**Recommended:** job queue for ingestion/embedding

* Simple: `bullmq` + Redis
* Alternative: `pg-boss` (Postgres-backed queue)

---

## 5) Data & Storage Layer

### 5.1 Primary Database

**Recommended:** Postgres

* Rationale: reliable, already in use, strong ecosystem.

### 5.2 ORM

**Recommended:** Prisma

* Rationale: matches existing code; good migrations and typing.

### 5.3 Vector Search

**Recommended:** pgvector (inside Postgres)

* Rationale: simplest operational footprint for v1; keeps data in one place.
* Add indexes (ivfflat/hnsw) as volume grows.

**Alternative (later):** dedicated vector DB

* Pinecone / Weaviate / Qdrant if scale/latency demands it.

### 5.4 Search/Retrieval Add-ons (optional)

* Keyword search: Postgres full-text search or `tsvector` columns
* Hybrid retrieval (vector + keyword) can improve precision.

---

## 6) LLM / AI Layer

### 6.1 Embeddings

**Recommended:** choose one provider and standardize

* OpenAI embeddings or Google embeddings are both fine; prioritize:

  * cost stability
  * latency
  * ease of key management

**Implementation guidance:**

* Store `embeddingModel` + `embeddingDim` per chunk (or per workspace) to support future migrations.

### 6.2 Retrieval Strategy

**Recommended (v1):**

* Vector top-K retrieval across corpora (docs + kb)
* Bias docs for navigation candidates
* Always return citations

**Recommended (later):**

* Add a reranker (cross-encoder) for better relevance
* Add “route suggestion” logic that prefers nav-tree relevance

### 6.3 Answer Generation

**Recommended:**

* Use a general-purpose model for response + citation formatting
* Apply system-level constraints:

  * always include citations
  * provide at least one docs route
  * pivot to ticket draft on low confidence

---

## 7) Auth, Access, and Security

### 7.1 v1 Pilot (Behind Cloudflare Tunnel)

**Recommended:**

* Cloudflare Tunnel for network gating
* Docs-site server proxy to Verbatim API (keeps secrets off client)

### 7.2 Upgrade to SSO (Planned)

**Recommended:**

* Docs site uses company SSO (IdP)
* Docs site mints short-lived tokens or forwards identity context to Verbatim

**Token style:**

* Short-lived JWT with scopes:

  * allowed corpora
  * workspace
  * rate limits

### 7.3 Rate Limiting

**Recommended (v1):**

* Basic rate limiting at proxy (per IP)

**Recommended (later):**

* Per-user/per-org limits once SSO exists

---

## 8) Ticketing Integration

### 8.1 Freshdesk

**v1:** ticket draft only (no submission)

* Feature flag: `ENABLE_FRESHDESK_TICKETS=false`

**Later:** enable submission

* Store credentials in server env
* Create tickets server-side only

---

## 9) Observability & Operations

### 9.1 Logging

**Recommended:** structured logs

* Include request ids, workspaceId, corpusScope, latency, top citations

### 9.2 Error Monitoring

**Recommended:** Sentry

* Frontend (widget) + backend (Verbatim API)

### 9.3 Metrics

**Recommended (later):**

* Prometheus + Grafana, or a hosted alternative
* Track retrieval latency, token usage, error rates

---

## 10) Deployment

### 10.1 v1 Pilot

**Recommended:** deploy Verbatim where it’s easiest to operate behind Tunnel

* Single service + Postgres
* Cloudflare Tunnel provides access gating

### 10.2 Production (Later)

* Separate environments (dev/stage/prod)
* CI/CD pipeline
* Background job workers if ingestion is async

---

## 11) Recommended Minimal Repo Structure (v1)

* `apps/docs` — developer docs site (widget lives here)
* `apps/verbatim` — Verbatim API + internal UI
* `packages/contracts` — shared TS types for API requests/responses
* `packages/tokens` — (if applicable) shared styling tokens

---

## 12) Key Tradeoffs (Why this stack)

* **Next.js for v1** keeps velocity high (you already have it).
* **Postgres + pgvector** minimizes infrastructure.
* **Docs-site proxy** avoids leaking secrets and sets you up for SSO.
* **H2 chunking + anchors** enables linkable citations.
* **Feature-flagged ticket submission** avoids blocking on Freshdesk permissions.
