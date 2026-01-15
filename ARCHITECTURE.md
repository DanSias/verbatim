# Verbatim Architecture & Ingestion Spec (Living Document)

## 0. Source of Truth

This document is the authoritative specification for Verbatim v1. If the code or implementation behavior conflicts with this document, the code is wrong.

---

## 1. Executive Summary

Verbatim is a documentation assistant that:

* Ingests developer documentation content (Next.js MDX pages) and Freshdesk knowledge base exports (Markdown).
* Answers natural-language questions with **always-on citations**.
* Provides **navigation guidance** to relevant developer documentation routes.
* When confidence is low, pivots to **ticket creation assistance** by generating a structured ticket draft (and later submitting to Freshdesk).

Verbatim ships in two user-facing surfaces:

1. **Docs Widget** embedded in the developer documentation site (partner-facing, private).
2. **Internal Web UI** used by the team for ingestion, debugging, and operational control.

Verbatim also exposes a **robust API** to support the widget today and internal/support tooling in the future.

---

## 2. Goals, Non-Goals, and Success Criteria

### 2.1 v1 Goals

* **Ingestion**: Bulk ingest of (a) developer docs MDX pages, and (b) Freshdesk KB Markdown exports.
* **Answering**: Natural language answers with citations.
* **Navigation**: Provide a primary “start here” route and related routes from the developer docs.
* **Docs widget integration**: A chat box embedded on the docs site that calls Verbatim APIs.
* **Internal Web UI**: Upload batches, inspect documents/chunks, and debug retrieval/answers.
* **Ticket assistance**: Generate a ticket draft that includes conversation context and citations.

### 2.2 v1 Non-Goals

* Public-facing access (docs are private/partner-only).
* Full SSO integration (SSO is planned; v1 runs as an internal pilot behind Cloudflare Tunnel).
* Automatic GitLab syncing/webhooks (v1 uses manual, batch-based uploads).
* Content versioning/history.
* PDFs and Google Docs ingestion (explicitly deferred).
* Per-corpus or per-user ACLs (dataset is considered safe; no PII/secrets expected).

### 2.3 Success Criteria (v1)

* Developers can ask a question and receive:

  * a concise answer,
  * citations,
  * and at least one relevant docs route suggestion.
* Internal team can ingest and re-ingest content without identity collisions or stale chunks.
* Low-confidence questions reliably generate a high-quality ticket draft.

---

## 3. Users, Surfaces, and Ownership

### 3.1 Primary Users

* **Internal team**: Uses internal web UI for ingestion, debugging, and operations.
* **Merchant developers / partners**: Use the embedded docs widget for Q&A and navigation.

### 3.2 Surfaces

* **Developer Docs Widget** (in docs site):

  * Displays assistant responses.
  * Shows citations.
  * Presents primary/related navigation links.
  * Offers “Create ticket” flow when needed.

* **Internal Web UI** (Verbatim app):

  * Upload docs batch.
  * Upload KB batch.
  * Inspect documents and chunks.
  * Inspect retrieval traces and citations.
  * Delete documents/corpora for cleanup.

### 3.3 Ownership Boundary

* The **docs site owns widget visibility and UI logic**:

  * Whether the widget renders on a route/page.
  * What context it sends (current route, section, page title).
  * How it displays links.

* **Verbatim owns ingestion, retrieval, and answer generation**:

  * Content normalization and identity.
  * Chunking and persistence.
  * Retrieval and response construction.
  * Ticket draft generation.

---

## 4. Core Concepts and Data Model

### 4.1 Workspace

A Workspace is a top-level container for documents (e.g., a pilot workspace for internal testing).

### 4.2 Corpus

A Corpus is a logical collection of sources. v1 defines:

* `docs`: Next.js developer documentation content (MDX pages).
* `kb`: Freshdesk knowledge base exports (Markdown).

### 4.3 Document

A Document is an ingested unit of content.

#### Document Identity (Critical)

Verbatim uses a route-first identity system for docs and a path-first identity system for KB.

* **Canonical ID**: Stable, deterministic identity used for upserts and deduplication.

  * Docs: `docs:/some/route`
  * KB: `kb:relative/path/to/article.md`

* **Route**: Docs-only, used for navigation and citations.

  * Example: `/certification`

* **Source Path**: Relative file path for traceability.

  * Example: `certification/page.mdx`

### 4.4 Chunk

A Chunk is a retrieval unit derived from a Document. Each Chunk references its parent Document.

### 4.5 Citation

A Citation is a reference to a specific source used in an answer. Citations are **always included**.

---

## 5. Ingestion Requirements (Non-Negotiable Invariants)

These invariants exist to prevent identity collisions (e.g., many `page.mdx` files) and stale retrieval results.

1. **Docs canonical identity is the route**, not the filename.
2. **sourcePath is metadata only**; it must not be the canonical identity for docs.
3. Chunking/embedding is tied to canonical identity.
4. Re-ingesting changed content must refresh chunks.
5. Navigation suggestions must only include docs routes.

---

## 6. Ingestion Rules

### 6.1 Supported Inputs (v1)

* Folder upload (batch)
* Single file upload (optional)

### 6.2 Docs Corpus (Next.js MDX)

#### What is ingested

* **Only** routed pages: `**/page.mdx` (v1).
* Non-page MDX files (components/partials) are ignored in v1.

#### Route derivation

Given a relative path `relPath`:

* `page.mdx` at root → route `/`
* `certification/page.mdx` → route `/certification`
* `guides/webhooks/page.mdx` → route `/guides/webhooks`

#### Canonical ID

* `canonicalId = "docs:" + route`

#### Display title

Derived in order:

1. frontmatter `title`
2. first H1
3. folder name humanized

### 6.3 KB Corpus (Freshdesk Markdown)

#### What is ingested

* `**/*.md` exported articles

#### Canonical ID

* `canonicalId = "kb:" + sourcePath` (relative path)

#### Route

* `route = null`

### 6.4 Batch Upload Semantics

* Uploads are performed in batches (e.g., 10 files per request).
* Each request includes:

  * `workspaceId`
  * `corpus` (`docs` or `kb`)
  * files (as multipart form-data)

### 6.5 Re-ingestion and Updates

* Each document stores a `contentHash`.
* On ingest, compute new hash.
* If hash is unchanged: no chunk regeneration.
* If hash changed:

  * delete existing chunks
  * regenerate chunks

No versioning is stored in v1.

---

## 7. Source Precedence and Truth Model

The KB content was authored by humans and served as the basis for doc page content.

### 7.1 Conflict Handling

* If sources conflict, prefer **KB** phrasing/claims.
* When an answer uses both, cite both.

### 7.2 Navigation Policy

* Regardless of precedence, navigation links always point to **docs routes**.
* KB is used for background and better answers, but not for end-user linking.

---

## 8. Chunking Specification (v1)

### 8.1 Goals

* Maintain semantic coherence (chunks should read like complete, useful sections).
* Preserve heading context.
* Keep chunks under retrieval/embedding limits.
* Enable **linkable citations** for docs content (route + `#anchor`).

### 8.2 Chunk Boundary Rules (v1)

Verbatim uses **corpus-aware chunking**.

#### Docs corpus (`docs`)

* **Chunk boundary = H2 (`##`)**.
* H1 (`#`) is treated as page-level context (kept inline; not a chunk boundary).
* H3+ headings remain **inside** the H2 chunk content (they provide structure but do not split chunks).

This aligns chunk identity with linkable sections on the docs site.

#### KB corpus (`kb`)

* **Chunk boundary = H2 (`##`)** by default (same as docs for consistency).
* If an article has no H2 headings, the entire article becomes one chunk (then size-split if needed).

### 8.3 Anchors and Linkable Citations (Docs)

For docs chunks, Verbatim computes and stores an **anchor** for the chunk’s H2 heading using the **same slugging behavior as the docs site** (GitHub-style slugging, including `-1`, `-2` for duplicates).

* Citation target URL format: `{route}#{anchor}`

  * Example: `/merchant-accounts#merchant-account-setup`

If a single H2 section is split into multiple windows due to size, all resulting chunks share the same `{route}#{anchor}` citation target (landing the user at the correct section).

### 8.4 Size Splitting (All Corpora)

Within a chunk boundary (typically an H2 section), if content exceeds `maxChars`, split into overlapping windows.

Defaults:

* `maxChars = 4000`
* `overlapChars = 400`

### 8.5 Metadata Stored Per Chunk (v1)

Each chunk stores:

* `headingPath`: breadcrumb for display/debugging (Docs: `[H1?, H2]`; KB: `[H2]` when present)
* `anchor` (docs only; optional/nullable for KB)
* `content`

### 8.6 Notes

* MDX components should be stripped or normalized into text during parsing.
* Keep code blocks and headings; they are highly valuable for retrieval.

---

## 9. Retrieval and Answering

### 9.1 Response Requirements

Every response must include:

* A concise natural-language answer.
* **Citations**.
* A primary “start here” docs route suggestion.
* Related docs route suggestions where helpful.

### 9.2 Answer Style

* Default to concise and actionable.
* Prefer answering over asking follow-up questions.
* Follow-ups are allowed only when necessary to avoid wrong guidance.

### 9.3 Low Confidence Behavior

When confidence is low, Verbatim must:

* Provide a brief best-effort answer.
* Explicitly indicate uncertainty.
* Offer to generate a ticket draft.

#### Low confidence triggers (v1)

* Too few relevant chunks retrieved.
* Conflicting sources.
* Question appears account-specific or requires private data.
* Citation coverage is weak.

---

## 10. Conversation and Memory

### 10.1 v1 Memory Scope

* Memory is limited to a single chat session.
* The client supplies a `conversationId` to maintain context.

### 10.2 Reset

* Widget provides a “Reset chat” action that clears session context.

---

## 11. API Specification (v1)

### 11.1 Consumers

* Docs site widget
* Internal web UI

### 11.2 Authentication (v1 Pilot)

* v1 runs behind Cloudflare Tunnel; application-level auth is deferred.
* Recommended: docs site proxies requests to Verbatim with an internal shared token so the browser never holds secrets.

### 11.3 Endpoints (Recommended)

#### POST /ask

**Request**

* `question: string`
* `workspaceId: string`
* `conversationId?: string`
* `context?: { route?: string; pageTitle?: string; navSection?: string }`
* `corpusScope?: Array<'docs'|'kb'>` (optional; defaults to both)

**Response**

* `answer: string`
* `citations: Array<{ corpus: 'docs'|'kb'; canonicalId: string; route?: string; sourcePath: string; headingPath?: string; excerpt?: string }>`
* `suggestedRoutes: Array<{ route: string; title?: string; reason?: string }>`
* `relatedRoutes: Array<{ route: string; title?: string }>`
* `confidence: { score: number; label: 'high'|'medium'|'low' }`
* `ticketDraft?: { subject: string; description: string; includedCitations: string[] }`

#### POST /ticket-draft

Generates a ticket draft from a conversation and optional question.

* Always available in v1.

#### POST /tickets (future, feature-flagged)

Creates a Freshdesk ticket.

* Enabled only once credentials/permissions are confirmed.

---

## 12. Ticket Creation (Freshdesk)

### 12.1 v1 Mode: Draft-Only

* Default: `ENABLE_FRESHDESK_TICKETS=false`
* System generates a structured ticket draft.
* User copies draft (or internal team uses it).

### 12.2 Future Mode: Submit

When enabled:

* Create ticket server-side.
* Include:

  * user summary
  * steps tried
  * relevant citations
  * recommended next actions

---

## 13. Internal Web UI Requirements (v1)

### 13.1 Ingestion

* Upload docs batch
* Upload KB batch
* Show ingest results per file (ok/skipped/error)

### 13.2 Inspection

* List documents (filter by corpus)
* Inspect a document (route/sourcePath/title/contentHash)
* Inspect chunks for a document

### 13.3 Debugging

* Ask a question in UI
* See retrieval trace:

  * which documents/chunks were retrieved
  * why routes were suggested
  * citations returned

### 13.4 Deletion / Cleanup

* Delete a document (and cascaded chunks)
* Delete all documents in a corpus (admin)

---

## 14. Operational Considerations

### 14.1 Deployment

* v1 pilot behind Cloudflare Tunnel.
* Logs must include:

  * ingestion batch results
  * retrieval latency and top citations
  * errors with enough detail to reproduce

### 14.2 Rate Limiting

* v1: light rate limiting (per IP / per tunnel access) to prevent accidental overload.
* Later: per-user/per-partner rate limiting once SSO exists.

### 14.3 Observability

* Support returning debug fields via an API flag (e.g., `debug=true`).
* Avoid returning full chunk text unless explicitly requested.

---

## 15. Implementation Notes (Current Code Alignment)

### 15.1 Current Risks to Address

* Ensure multipart field names match (`files` vs `files[]`).
* Ensure docs ingestion is route-first (avoid `page.mdx` collisions).
* Re-ingestion must refresh chunks when content changes.
* Separate corpora (`docs` vs `kb`) to improve citations and navigation.

### 15.2 Minimal Schema Evolution

Recommended additions:

* `canonicalId` (unique per workspace)
* `corpus` enum
* `route` nullable

---

## 16. Roadmap (Post-v1)

* Integrate company SSO for partner-authenticated widget usage.
* Optional GitLab sync/webhooks.
* Add PDF and Google Docs ingestion.
* Add multi-corpus and/or multi-workspace support per product area.
* Add ticket submission once Freshdesk credentials are validated.
* Add answer style modes (concise vs troubleshooting vs conceptual).
