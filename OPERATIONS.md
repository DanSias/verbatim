# OPERATIONS.md — Verbatim (v1 Pilot Runbook)

This document describes **how Verbatim is operated day-to-day** during the v1 pilot. It is intentionally practical and procedural. It assumes the architecture and tech stack defined in `ARCHITECTURE.md` and `TECH_STACK.md`.

---

## 1. Scope and Assumptions

### 1.1 Scope

This runbook covers:

* Local development
* Batch ingestion of docs and KB content
* Verifying ingestion correctness
* Re-ingestion and cleanup
* Debugging answers and citations
* Operational safety during the pilot

### 1.2 Assumptions

* Verbatim is running behind **Cloudflare Tunnel**.
* Application-level auth is deferred (internal pilot only).
* Docs widget calls Verbatim via a **docs-site server proxy**.
* All ingested content is considered safe (no PII/secrets).

---

## 2. Local Development

### 2.1 Required Services

* Node.js (LTS)
* Postgres (with pgvector enabled)
* Environment variables configured

### 2.2 Start Services

1. Start Postgres
2. Start Verbatim app
3. (Optional) Start docs site

Verify:

* Verbatim API responds at `/ask`
* Internal UI loads

---

## 3. Ingestion Workflows

### 3.1 Docs Corpus Ingestion

**Purpose:** Import developer documentation pages for navigation + answering.

**Rules:**

* Only `**/page.mdx` files are ingested.
* Canonical identity is the **docs route**, not the filename.

**Command (example):**

```
npx tsx scripts/bulk-ingest.ts <workspace-id> <docs-root> --corpus docs
```

**Expected behavior:**

* Script recursively scans folders.
* Only `page.mdx` files are uploaded.
* Each file maps to one docs route.

### 3.2 KB Corpus Ingestion

**Purpose:** Import Freshdesk knowledge base background material.

**Rules:**

* All `.md` files are ingested.
* Canonical identity is the relative path.

**Command (example):**

```
npx tsx scripts/bulk-ingest.ts <workspace-id> <kb-root> --corpus kb
```

---

## 4. Verifying Ingestion

After any batch ingest:

### 4.1 Document Checks

* Confirm document count roughly matches expected pages/articles.
* Spot-check:

  * docs documents have a `route`
  * kb documents do **not** have a route

### 4.2 Chunk Checks

* For docs:

  * Each H2 section corresponds to one logical chunk (or windowed chunks).
  * Chunks share the same `{route}#{anchor}`.

* For KB:

  * Chunks are grouped by H2 where present.

### 4.3 Common Red Flags

* Multiple documents with route `/` (indicates bad root handling).
* Documents created for non-`page.mdx` files.
* Chunks without content or headings.

---

## 5. Re-Ingestion and Updates

### 5.1 When to Re-Ingest

* Docs content changes
* KB exports updated
* Chunking logic changes

### 5.2 Expected Re-Ingest Behavior

* If `contentHash` is unchanged: no chunk regeneration.
* If `contentHash` changes:

  * existing chunks are deleted
  * new chunks are generated

### 5.3 Safe Re-Ingest Procedure

1. Re-run bulk ingest for the affected corpus.
2. Verify document + chunk counts.
3. Test a known question against updated content.

---

## 6. Deletion and Cleanup

### 6.1 Deleting a Single Document

Use the internal UI to:

* delete the document
* confirm chunks are cascaded

### 6.2 Full Corpus Reset (Emergency)

Use only if ingestion is badly corrupted.

Steps:

1. Delete all documents for the corpus.
2. Re-run bulk ingest.
3. Spot-check routes and citations.

---

## 7. Debugging Answers

### 7.1 Debug View

When debugging an answer, inspect:

* Retrieved documents
* Retrieved chunks
* Anchors used for citations
* Suggested routes

### 7.2 Common Issues

**Wrong route suggested**

* Check document `route` and `canonicalId`.
* Confirm navigation tree alignment.

**Answer is outdated**

* Verify `contentHash` changed and chunks were regenerated.

**Answer too narrow or fragmented**

* Check chunk boundaries (ensure H2-based chunking).

---

## 8. Low Confidence and Ticket Drafts

### 8.1 Expected Behavior

When confidence is low:

* Verbatim provides a brief answer
* Explicitly signals uncertainty
* Offers to generate a ticket draft

### 8.2 Ticket Draft Contents

* Issue summary
* Steps attempted (from conversation)
* Relevant citations (routes + anchors)

---

## 9. Operational Safety (Pilot)

### 9.1 Rate Limiting

* Light rate limiting only (prevent accidental abuse).

### 9.2 Feature Flags

* `ENABLE_FRESHDESK_TICKETS=false`

### 9.3 Logging Checklist

Ensure logs include:

* workspaceId
* corpusScope
* top citations
* latency

---

## 10. When Things Go Wrong

### 10.1 Ingestion Failures

* Check batch response details.
* Look for multipart field mismatches.
* Retry the failed batch only.

### 10.2 Retrieval Seems Broken

* Verify vector index health.
* Inspect raw chunks for affected documents.
* Test with a known-good question.

### 10.3 Panic Button

If unsure:

1. Stop ingestion.
2. Snapshot DB if possible.
3. Reset affected corpus.
4. Re-ingest cleanly.

---

## 11. Transition to Production

Before opening beyond the pilot:

* Add SSO-based auth
* Enforce per-user/per-org rate limits
* Enable structured monitoring dashboards
* Confirm ticket submission permissions

---

## 12. Operator Principles

* Prefer **deterministic re-ingest** over manual fixes.
* Treat docs routes as the source of truth for navigation.
* If behavior is surprising, check identity and chunking first.
* Keep operations boring.
