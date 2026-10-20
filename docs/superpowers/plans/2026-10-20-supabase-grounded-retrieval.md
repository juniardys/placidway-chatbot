# Supabase Grounded Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement tested Supabase persistence, pgvector similarity RPC, server-side repository, and retrieval that answers only from active, sufficiently relevant evidence.

**Architecture:** Supabase Postgres stores allowlisted sources, fetched snapshots, chunk embeddings, and minimal chat outcomes. A server-only repository calls a database RPC for active-vector similarity search and exposes typed methods to ingestion and retrieval. Retrieval embeds the user query, applies score and citation validation, and returns grounded chunks; no production ingestion runs while source URLs remain placeholders.

**Tech Stack:** Bun, TypeScript, Next.js server modules, `@supabase/supabase-js`, Supabase SQL/pgvector, LangChain OpenAI-compatible embeddings, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-placidway-chatbot-design.md`

## Global Constraints

- Embedding model: `sumo/text-embedding-3-small`.
- Embedding dimension: `1536`; database column must be `vector(1536)`.
- Retrieval uses only active chunks from the active snapshot.
- Similarity threshold defaults to `RETRIEVAL_MIN_SCORE=0.72`; top-k defaults to `RETRIEVAL_TOP_K=6`.
- Citation metadata comes from stored rows, never from model output.
- Server-only Supabase/provider access; no secret in browser code or subagent prompts.
- Exactly seven configured source entries are required; placeholder URLs must fail production ingestion validation.
- Failed refreshes preserve the previous active snapshot.
- Tests use mocked Supabase/provider boundaries; no real credentials or production ingestion.

## Review Focus

- RPC must not return chunks from inactive snapshots or inactive chunks; pin with active-snapshot retrieval test.
- Vector dimension mismatch must fail before persistence; pin with repository validation test.
- Malformed citation metadata must be excluded, not repaired with invented URLs; pin with retrieval test.
- Empty or below-threshold evidence must return controlled unknown state without LLM generation; pin with retrieval boundary test.
- Placeholder source URLs must block production refresh while allowing deterministic fixtures; pin with source configuration test.

---

### Task 1: Lock repository contracts with failing tests

**Files:**

- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/repositories.ts`
- Create: `tests/db/repositories.test.ts`
- Create: `tests/retrieval/retrieve.test.ts`

**Interfaces:**

- `RetrievedChunk`: `{ id: string; content: string; sourceId: string; title: string; url: string; pageType: string; section: string | null; fetchedAt: string; contentHash: string; similarity: number }`.
- `Repository`: `getActiveChunks(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]>`.
- `Repository`: `insertSourceSnapshot(input): Promise<string>` and `activateSnapshot(snapshotId: string): Promise<void>`.
- `Repository`: `insertChunks(input): Promise<void>` and `logChatOutcome(input): Promise<void>`.
- `retrieveEvidence(question: string, history: ChatMessage[]): Promise<RetrievedChunk[]>`.

- [ ] **Step 1: Write failing repository tests** asserting RPC arguments include a 1536-length embedding and limit, returned rows preserve source metadata, and only typed `RetrievedChunk` values escape the repository.
- [ ] **Step 2: Write failing retrieval tests** asserting query embedding is used, results below `RETRIEVAL_MIN_SCORE` are removed, malformed URL/source metadata is removed, and empty evidence returns an empty list.
- [ ] **Step 3: Run targeted tests.**

Run: `bun test tests/db/repositories.test.ts tests/retrieval/retrieve.test.ts`

Expected: FAIL because repository and retrieval contracts are incomplete.

---

### Task 2: Add Supabase pgvector migration and active-search RPC

**Files:**

- Create or modify: `supabase/migrations/001_knowledge_base.sql`
- Create: `tests/db/migration-contract.test.ts`

**Interfaces:**

- SQL function: `match_knowledge_chunks(query_embedding vector(1536), match_threshold real, match_count integer)`.
- RPC result columns: `id`, `content`, `source_id`, `title`, `url`, `page_type`, `section`, `fetched_at`, `content_hash`, `similarity`.

- [ ] **Step 1: Write migration contract tests** checking `vector(1536)`, required tables, active flags/status fields, indexes, and RPC name/signature.
- [ ] **Step 2: Run migration contract test and verify failure.**
- [ ] **Step 3: Implement migration** with `vector` extension; source, snapshot, chunk, and chat-log tables; foreign keys; timestamps; content hashes; active snapshot/chunk state; and an HNSW or IVFFlat cosine index appropriate for `vector(1536)`.
- [ ] **Step 4: Implement `match_knowledge_chunks`** joining chunks to sources and snapshots, filtering active chunks plus active successful snapshot, applying `similarity >= match_threshold`, ordering by cosine similarity descending, and limiting results.
- [ ] **Step 5: Add least-privilege RPC/table grants** consistent with server-side Supabase access; never expose service secrets in SQL or tests.
- [ ] **Step 6: Run migration contract test.**

Run: `bun test tests/db/migration-contract.test.ts`

Expected: PASS.

---

### Task 3: Implement server-side Supabase client and repository

**Files:**

- Create: `src/lib/db/client.ts`
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/repositories.ts`
- Modify: `tests/db/repositories.test.ts`

**Interfaces:**

- `getServerSupabase(): SupabaseClient` using server-only environment values.
- `createRepository(client = getServerSupabase()): Repository`.
- `getActiveChunks(queryEmbedding, limit)` calls `client.rpc('match_knowledge_chunks', { query_embedding, match_threshold, match_count })`.
- Write methods use parameterized Supabase inserts/updates and return typed IDs/errors.

- [ ] **Step 1: Implement server client factory** without importing it from client components and without making network calls at module import time.
- [ ] **Step 2: Implement repository RPC mapping** with explicit row validation, score conversion, and metadata preservation.
- [ ] **Step 3: Reject invalid embedding length** unless it equals `1536`; reject non-positive limits; surface safe repository errors.
- [ ] **Step 4: Implement source/snapshot/chunk persistence, activation, and chat outcome logging** using typed inputs and active snapshot semantics.
- [ ] **Step 5: Run repository tests.**

Run: `bun test tests/db/repositories.test.ts`

Expected: PASS.

---

### Task 4: Implement grounded embedding retrieval

**Files:**

- Modify: `src/lib/retrieval/retrieve.ts`
- Modify: `src/lib/llm/embeddings.ts` if needed
- Modify: `tests/retrieval/retrieve.test.ts`
- Create: `tests/retrieval/production-ingestion-gate.test.ts`

**Interfaces:**

- `retrieveEvidence(question: string, history: ChatMessage[]): Promise<RetrievedChunk[]>`.
- Query text combines bounded question/history only for embedding; history cannot override evidence.
- Retrieval calls embeddings with configured `EMBEDDING_MODEL` and `1536` dimensions, then repository `getActiveChunks`.

- [ ] **Step 1: Implement bounded query construction** using max `MAX_HISTORY_MESSAGES`; do not include secrets or raw provider errors.
- [ ] **Step 2: Implement embedding call and repository retrieval** with configured top-k and minimum score.
- [ ] **Step 3: Validate citation metadata** (`sourceId`, non-empty title, absolute `http`/`https` URL, content, and finite similarity); drop malformed rows.
- [ ] **Step 4: Add production ingestion gate** that requires exactly seven allowlist entries and rejects placeholder URLs before any fetch/embed/write operation.
- [ ] **Step 5: Run retrieval and gate tests.**

Run: `bun test tests/retrieval/retrieve.test.ts tests/retrieval/production-ingestion-gate.test.ts`

Expected: PASS.

---

### Task 5: Connect grounded retrieval to answer flow and verify

**Files:**

- Modify: `src/lib/chat/answer.ts`
- Modify: `src/lib/policy/answer-policy.ts`
- Modify: `src/app/api/chat/route.ts` only where needed
- Create or modify: `tests/api/chat-grounding.test.ts`

**Interfaces:**

- Empty/insufficient evidence produces controlled unknown response and free-quote suggestion without calling the LLM.
- Factual generated answers receive only validated evidence and citations generated from repository metadata.
- Provider failures emit safe SSE error events and never expose keys, prompts, stack traces, or raw provider errors.

- [ ] **Step 1: Write failing chat grounding tests** for empty KB, below-threshold evidence, valid citations, malformed citation rows, and provider failure.
- [ ] **Step 2: Run targeted test and verify failure.**
- [ ] **Step 3: Implement evidence gate before model generation.**
- [ ] **Step 4: Implement citation projection from `RetrievedChunk` metadata only.**
- [ ] **Step 5: Preserve existing policy behavior** for prices, comparisons, appointment refusal, out-of-scope questions, and medical disclaimer without allowing unsupported claims.
- [ ] **Step 6: Run targeted tests.**

Run: `bun test tests/api/chat-grounding.test.ts`

Expected: PASS.

---

### Task 6: Full verification and documentation update

**Files:**

- Modify: `README.md`
- Modify: `docs/implementation-progress.md`

- [ ] **Step 1: Document migration execution, RPC contract, server-only repository, retrieval threshold, and production URL gate.**
- [ ] **Step 2: Confirm `.env.local` is ignored and no secret appears in tracked/source files.**
- [ ] **Step 3: Run full verification.**

Run:

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

Expected: all commands pass.

- [ ] **Step 4: Mark only implemented items complete in `docs/implementation-progress.md`; explicitly leave real ingestion/deployment blocked until seven actual URLs and runtime credentials are supplied.**
