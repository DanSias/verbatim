-- Verbatim Initial Migration
-- Based on ARCHITECTURE.md Section 4 (Core Concepts and Data Model)

-- Enable pgvector extension for vector similarity search
-- See TECH_STACK.md Section 5.3
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Section 4.2: Corpus enum
-- ============================================================================

CREATE TYPE "Corpus" AS ENUM ('docs', 'kb');

-- ============================================================================
-- Section 10: MessageRole enum
-- ============================================================================

CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- ============================================================================
-- Section 4.1: Workspace
-- A top-level container for documents
-- ============================================================================

CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Section 4.3: Document
-- An ingested unit of content with route-first identity (docs) or path-first (kb)
-- ============================================================================

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "corpus" "Corpus" NOT NULL,
    "route" TEXT,
    "sourcePath" TEXT NOT NULL,
    "title" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Canonical identity constraint: canonicalId must be unique within a workspace
-- This enforces ARCHITECTURE.md Section 5 invariant #1 (route-first identity)
CREATE UNIQUE INDEX "documents_workspaceId_canonicalId_key" ON "documents"("workspaceId", "canonicalId");

-- Index for filtering by corpus within a workspace
CREATE INDEX "documents_workspaceId_corpus_idx" ON "documents"("workspaceId", "corpus");

-- ============================================================================
-- Section 4.4: Chunk
-- A retrieval unit derived from a Document
-- ============================================================================

CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "headingPath" TEXT[],
    "anchor" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- Index for retrieving chunks by document
CREATE INDEX "chunks_documentId_idx" ON "chunks"("documentId");

-- HNSW index for fast approximate nearest neighbor search
-- See TECH_STACK.md Section 5.3 (add indexes as volume grows)
CREATE INDEX "chunks_embedding_idx" ON "chunks"
USING hnsw ("embedding" vector_cosine_ops);

-- ============================================================================
-- Section 10: Conversation and Message
-- Session-scoped memory for chat context
-- ============================================================================

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_workspaceId_idx" ON "conversations"("workspaceId");

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- ============================================================================
-- Foreign Key Constraints (with CASCADE delete)
-- ============================================================================

-- Document -> Workspace
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Chunk -> Document
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Conversation -> Workspace
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Message -> Conversation
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
