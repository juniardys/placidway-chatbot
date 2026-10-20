# Complete PlacidWay Assessment Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PlacidWay chatbot so all eight assessment behaviors pass with grounded answers, safe fallbacks, real refresh capability, centralized system prompt, and documented verification.

**Architecture:** Deterministic validation and policy run before retrieval/model generation. Retrieval returns only active, sufficiently relevant chunks with validated source metadata; factual answers use a centralized system prompt plus grounded evidence, while citations are projected from repository metadata. A shared refresh service powers both manual endpoint and persistent-runtime cron, with atomic snapshot activation.

**Tech Stack:** Bun, Next.js App Router, TypeScript, Tailwind, LangChain JS, OpenAI-compatible 9router, Supabase SSR/Data API, PostgreSQL/pgvector, node-cron, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-complete-assessment-chatbot-design.md`

## Global Constraints

- Use exactly seven configured allowlisted source entries; never crawl discovered links.
- Use `sumo/text-embedding-3-small` with `EMBEDDING_DIMENSIONS=1536` and `vector(1536)`.
- Use `RETRIEVAL_TOP_K=6`, `RETRIEVAL_MIN_SCORE=0.72`, and `MAX_HISTORY_MESSAGES=10` defaults.
- Keep provider/database secrets server-only; never log raw provider errors, prompts, or secrets.
- Empty/insufficient evidence must not call the LLM.
- Citations must come only from validated stored metadata.
- Failed refreshes must preserve the previous active snapshot.
- Cron requires a persistent Bun/Node runtime and defaults to `0 3 * * *` UTC.
- Do not add general web browsing, appointment booking, diagnosis, payment, CRM, or discovered-link crawling.
- Do not commit real URLs, credentials, deployment secrets, or `.env.local`.

## Review Focus

- **Malformed request/history:** route rejects invalid lengths and roles without crashing; pinned in chat API tests.
- **Prompt injection in user/source content:** model receives evidence as untrusted data and never follows embedded instructions; pinned in answer/provider tests.
- **Partial refresh failure:** previous active snapshot remains queryable and new snapshot is not activated; pinned in refresh tests.
- **Client disconnect/provider failure:** stream closes and UI exits loading state without secret leakage; pinned in chat API and E2E tests.
- **Incomplete comparison or unsupported price premise:** policy refuses unsupported conclusions instead of inferring; pinned in acceptance policy tests.

---

### Task 1: Centralize constants, types, and acceptance fixtures

**Files:**

- Create: `src/lib/constants.ts`
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/env.ts`
- Create: `tests/acceptance/assessment-questions.md`
- Create: `tests/fixtures/knowledge-base.ts`
- Create: `tests/policy/acceptance-policy.test.ts`

**Interfaces:**

- Produces `CHATBOT_SYSTEM_PROMPT: string`.
- Produces typed constants for history/question limits, retrieval top-k, threshold, fallback responses, and disclaimer.
- `RetrievedChunk` uses one canonical content field: `content: string`, plus `sourceId`, `title`, `url`, `pageType`, `section`, `fetchedAt`, `contentHash`, and `similarity`.
- Fixture exports deterministic chunks representing price, package, recovery, comparison, and unsupported-price cases.

- [ ] **Step 1: Write failing tests** for constants, canonical `RetrievedChunk`, eight acceptance categories, and prompt requirements. Assert prompt mentions evidence-only answering, no invented prices/URLs, medical safety, appointment limitation, history-as-context, and no prompt disclosure.
- [ ] **Step 2: Run `bun test tests/policy/acceptance-policy.test.ts` and confirm failure.**
- [ ] **Step 3: Implement `src/lib/constants.ts`** with exact defaults and controlled response strings. Read numeric defaults from environment only through validated helpers; keep safe fallbacks for tests.
- [ ] **Step 4: Normalize `RetrievedChunk` consumers from `text` to `content` and update fixtures.**
- [ ] **Step 5: Add `tests/acceptance/assessment-questions.md`** containing one reproducible question and expected behavior for each PDF category.
- [ ] **Step 6: Run targeted tests and commit.**

Run: `bun test tests/policy/acceptance-policy.test.ts tests/retrieval/retrieve.test.ts`

Expected: PASS.

---

### Task 2: Complete deterministic answer policy

**Files:**

- Modify: `src/lib/policy/answer-policy.ts`
- Modify: `tests/policy/answer-policy.test.ts`
- Modify: `tests/policy/acceptance-policy.test.ts`

**Interfaces:**

- `classifyQuestion(question: string): PolicyDecision`.
- `PolicyDecision` supports factual, cost, comparison, package, follow-up, appointment, out-of-scope, medical, and unsupported-premise categories.
- Policy decisions can require evidence, require both comparison sides, attach controlled response text, or attach disclaimer requirements.

- [ ] **Step 1: Add failing tests** for all eight PDF categories, including incomplete comparison and unsupported `$50` premise.
- [ ] **Step 2: Implement deterministic classification** before model generation; preserve existing safe responses and use constants.
- [ ] **Step 3: Add tests for prompt-injection-like questions and irrelevant weather questions.**
- [ ] **Step 4: Run policy suite and commit.**

Run: `bun test tests/policy`

Expected: PASS.

---

### Task 3: Finish provider configuration and grounded answer generation

**Files:**

- Modify: `src/lib/llm/client.ts`
- Create or modify: `src/lib/llm/stream.ts`
- Modify: `src/lib/chat/answer.ts`
- Create: `tests/llm/provider-config.test.ts`
- Create: `tests/chat/answer.test.ts`

**Interfaces:**

- `getChatModel(): ChatOpenAI` uses normalized `LLM_ENDPOINT`, `LLM_API_KEY`, and `LLM_MODEL` without network calls at import time.
- `getEmbeddings(): OpenAIEmbeddings` uses configured embedding model and 1536 dimensions.
- `streamGroundedAnswer(input: { question: string; history: ChatMessage[]; evidence: RetrievedChunk[]; model?: ChatModel }): AsyncIterable<ChatEvent>`.
- `ChatEvent` citations are `{ sourceId: string; title: string; url: string }[]`, never full chunks.

- [ ] **Step 1: Write failing provider tests** for endpoint normalization, model values, embedding dimensions, and no import-time network call.
- [ ] **Step 2: Write failing answer tests** for evidence-only prompt input, valid citation projection, empty evidence no model call, policy responses no model call, provider failure safe event, and prompt-injection evidence treated as data.
- [ ] **Step 3: Implement provider factories** and stream adapter using `CHATBOT_SYSTEM_PROMPT`.
- [ ] **Step 4: Implement grounded answer generation** with evidence formatting that includes source metadata but asks model to emit no URLs/citations.
- [ ] **Step 5: Validate and project citations** from `RetrievedChunk` only.
- [ ] **Step 6: Run tests and commit.**

Run: `bun test tests/llm/provider-config.test.ts tests/chat/answer.test.ts`

Expected: PASS.

---

### Task 4: Complete retrieval and evidence gate

**Files:**

- Modify: `src/lib/retrieval/retrieve.ts`
- Modify: `src/lib/env.ts`
- Modify: `tests/retrieval/retrieve.test.ts`
- Create: `tests/retrieval/evidence-gate.test.ts`

**Interfaces:**

- `retrieveEvidence(question: string, history: ChatMessage[], deps?: RetrievalDeps): Promise<RetrievedChunk[]>`.
- `RetrievalDeps.embed(text): Promise<number[]>`.
- `RetrievalDeps.retrieve(vector, limit): Promise<RetrievedChunk[]>`.

- [ ] **Step 1: Add failing tests** for bounded question/history construction, `MAX_HISTORY_MESSAGES`, 4000-character history content cap, 1536 embedding use, configured top-k/threshold, below-threshold filtering, malformed URL/title/source/content filtering, and finite similarity.
- [ ] **Step 2: Implement bounded query construction** with history as context only.
- [ ] **Step 3: Implement embedding and repository retrieval** using constants/env values.
- [ ] **Step 4: Implement evidence metadata validation** and stable result ordering.
- [ ] **Step 5: Run retrieval tests and commit.**

Run: `bun test tests/retrieval`

Expected: PASS.

---

### Task 5: Complete Supabase migration and repository write boundary

**Files:**

- Modify: `supabase/migrations/001_knowledge_base.sql`
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/db/repositories.ts`
- Modify: `tests/db/repositories.test.ts`
- Modify: `tests/db/migration-contract.test.ts`

**Interfaces:**

- `getServerSupabase(): SupabaseClient`.
- `createRepository(client?: RepositoryClient): Repository`.
- `Repository.getActiveChunks(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]>`.
- `Repository.insertSourceSnapshot(input): Promise<string>`.
- `Repository.insertChunks(input): Promise<void>`.
- `Repository.activateSnapshot(snapshotId: string): Promise<void>`.
- `Repository.logChatOutcome(input): Promise<void>`.

- [ ] **Step 1: Add failing migration tests** for tables, `vector(1536)`, active flags/status, indexes, RPC signature/filtering, and least-privilege grants.
- [ ] **Step 2: Add failing repository tests** for RPC args, metadata mapping, 1536-length validation, positive limit validation, write methods, activation, and safe errors.
- [ ] **Step 3: Implement/adjust migration and active search RPC** joining only active successful snapshot and active chunks.
- [ ] **Step 4: Implement server-only client and typed repository methods** with mocked Supabase boundaries.
- [ ] **Step 5: Run DB tests and commit.**

Run: `bun test tests/db`

Expected: PASS.

---

### Task 6: Implement source fetching, normalization, chunking, and production gate

**Files:**

- Modify: `src/config/sources.ts`
- Modify: `src/lib/ingestion/sources.ts`
- Modify: `src/lib/ingestion/fetcher.ts`
- Modify: `src/lib/ingestion/normalize.ts`
- Create or modify: `src/lib/ingestion/chunk.ts`
- Modify: `tests/retrieval/production-ingestion-gate.test.ts`
- Create: `tests/ingestion/sources.test.ts`
- Create: `tests/ingestion/normalize.test.ts`
- Create: `tests/ingestion/chunk.test.ts`

**Interfaces:**

- `assertAllowedSource(url: string): AllowedSource`.
- `validateProductionSources(): void`.
- `fetchSource(source: AllowedSource, deps?): Promise<RawSnapshot>`.
- `normalizeSource(raw: RawSnapshot): NormalizedDocument`.
- `chunkDocument(document: NormalizedDocument): DocumentChunk[]`.

- [ ] **Step 1: Add failing tests** for exact seven IDs, placeholder rejection, URL allowlist rejection, robots denial, User-Agent, pacing injection, title/heading extraction, Markdown cleanup, SHA-256 hash, metadata retention, and heading-context chunking.
- [ ] **Step 2: Implement source configuration validation** while retaining placeholders for deterministic tests only.
- [ ] **Step 3: Implement robots check, fetcher, pacing abstraction, raw response capture, and safe fetch errors.**
- [ ] **Step 4: Implement normalization/hash and semantic chunking** preserving pricing/package/procedure/recovery/clinic/disclaimer context.
- [ ] **Step 5: Run ingestion tests and commit.**

Run: `bun test tests/ingestion/sources.test.ts tests/ingestion/normalize.test.ts tests/ingestion/chunk.test.ts tests/retrieval/production-ingestion-gate.test.ts`

Expected: PASS.

---

### Task 7: Implement atomic refresh service and cron

**Files:**

- Modify: `src/lib/ingestion/refresh.ts`
- Modify: `src/lib/ingestion/cron.ts`
- Modify or create: `src/instrumentation.ts`
- Create: `tests/ingestion/refresh.test.ts`
- Create: `tests/ingestion/cron.test.ts`

**Interfaces:**

- `refreshKnowledgeBase(deps?: RefreshDeps): Promise<RefreshResult>`.
- `startIngestionCron(refresh: () => Promise<void>): ScheduledTask`.
- `RefreshResult` includes `status: "success" | "unchanged" | "failed" | "skipped"`, safe counts, and safe failure details.

- [ ] **Step 1: Add failing refresh tests** for lock behavior, all-seven validation, unchanged hash reuse, changed source re-index, sequential fetch, partial/total failure, previous active snapshot preservation, atomic activation, and lock release.
- [ ] **Step 2: Implement refresh orchestration** using fetcher, normalizer, chunker, embeddings, and repository write methods.
- [ ] **Step 3: Add failing cron tests** for default schedule/timezone, invalid schedule handling, `noOverlap: true`, and refresh failure not crashing server.
- [ ] **Step 4: Implement server-only instrumentation startup** and shared lock behavior.
- [ ] **Step 5: Run refresh/cron tests and commit.**

Run: `bun test tests/ingestion/refresh.test.ts tests/ingestion/cron.test.ts`

Expected: PASS.

---

### Task 8: Complete chat and manual refresh API contracts

**Files:**

- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/admin/refresh/route.ts`
- Modify: `src/lib/chat/answer.ts`
- Create: `tests/api/chat.test.ts`
- Create: `tests/api/admin-refresh.test.ts`
- Create or modify: `tests/api/chat-grounding.test.ts`

**Interfaces:**

- `POST /api/chat` validates `{ question, history }`, streams documented SSE events, and handles aborts safely.
- `POST /api/admin/refresh` accepts `Authorization: Bearer <REFRESH_SECRET>` and returns 401/409/200/500 per contract.

- [ ] **Step 1: Add failing chat tests** for request validation, history bounds, SSE headers/order, empty KB no LLM call, valid factual answer, citations shape, malformed citations, policy responses, provider error, abort, and secret leakage.
- [ ] **Step 2: Implement route validation and bounded history** from constants, including per-message content limit.
- [ ] **Step 3: Wire model/evidence flow and chat outcome logging** with safe error handling and stream cancellation.
- [ ] **Step 4: Add failing admin endpoint tests** for missing/invalid secret, active refresh, successful refresh, unchanged result, and failed refresh.
- [ ] **Step 5: Implement endpoint status mapping** and safe JSON responses.
- [ ] **Step 6: Run API tests and commit.**

Run: `bun test tests/api`

Expected: PASS.

---

### Task 9: Finish public UI and E2E behavior

**Files:**

- Modify: `src/components/chat/chat-shell.tsx`
- Create or modify: `src/components/chat/message-list.tsx`
- Create or modify: `src/components/chat/message-composer.tsx`
- Create or modify: `src/components/chat/citation-list.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `playwright.config.ts`
- Create: `tests/e2e/chat.spec.ts`

**Interfaces:**

- UI consumes `/api/chat` SSE contract.
- UI state handles `idle | loading | streaming | error` and always exits loading on done/error/abort/malformed stream.

- [ ] **Step 1: Add Playwright tests** for submit, streamed delta, citations, retry, error state, keyboard submission, focus-visible controls, and mobile layout.
- [ ] **Step 2: Run E2E tests to confirm failure before UI completion.**
- [ ] **Step 3: Implement accessible responsive components** with safe text/Markdown rendering and citation links.
- [ ] **Step 4: Implement robust SSE parser** for blank-line events, malformed event recovery, abort, and retry.
- [ ] **Step 5: Verify styles** use exact transitions, minimum hit targets, concentric radii, restrained shadows, and no `transition-all`.
- [ ] **Step 6: Run E2E tests and commit.**

Run: `bunx playwright test tests/e2e/chat.spec.ts`

Expected: PASS.

---

### Task 10: Complete documentation and seeded acceptance answers

**Files:**

- Modify: `README.md`
- Modify: `docs/acceptance/answers.md`
- Modify: `docs/implementation-progress.md`
- Create: `docs/KNOWN-LIMITATIONS.md`

**Interfaces:**

- Documentation describes setup, architecture, env contract, migration, source allowlist, ingestion, cron, refresh endpoint, SSE, policy, tests, deployment runtime, and limitations.
- Acceptance answers records reproducible answers for all eight PDF categories using seeded fixtures, clearly labeled as seeded verification until real URLs are available.

- [ ] **Step 1: Write documentation tests/checks** that required headings, commands, endpoint paths, and no-secret rules exist.
- [ ] **Step 2: Rewrite README** to remove duplicate heading and stale `/todos`-only setup; document persistent runtime requirement.
- [ ] **Step 3: Fill `docs/acceptance/answers.md`** with question, expected behavior, actual seeded answer, citation fixture, and pass/fail result for all eight categories.
- [ ] **Step 4: Add known limitations/future improvements** including placeholder-source and deployment blockers.
- [ ] **Step 5: Update progress file** marking only verified code complete.
- [ ] **Step 6: Run documentation checks and commit.**

Run: `bun test`

Expected: PASS.

---

### Task 11: Full verification and external readiness gate

**Files:**

- Modify only files required by verification failures.
- Do not commit credentials or real source URLs.

- [ ] **Step 1: Run full local verification.**

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

Expected: all commands PASS.

- [ ] **Step 2: Run seeded acceptance suite** and compare each answer against PDF expected behavior.
- [ ] **Step 3: Confirm `.env.local` is ignored and scan tracked/source files for secrets.**
- [ ] **Step 4: With supplied runtime inputs, configure seven real URLs outside source control and run real ingestion.**
- [ ] **Step 5: Apply Supabase migration and verify active snapshot retrieval against real project.**
- [ ] **Step 6: Deploy to persistent Bun/Node runtime, verify public URL, cron startup, manual refresh auth, and seven-day availability requirement.**
- [ ] **Step 7: Record real deployment URL and runtime verification only in release/submission notes, never in source secrets.**

## Commit sequence

Use one focused commit per task after its test gate passes:

1. `feat: centralize chatbot constants and acceptance fixtures`
2. `feat: complete deterministic answer policy`
3. `feat: add grounded streaming answer generation`
4. `feat: complete evidence retrieval gate`
5. `feat: complete Supabase repository boundary`
6. `feat: implement source fetch normalization and chunking`
7. `feat: implement atomic refresh and cron`
8. `feat: complete chat and refresh API contracts`
9. `feat: complete chat UI and e2e coverage`
10. `docs: complete assessment documentation`
11. `chore: verify assessment readiness`

Repository currently has no confirmed Git-backed state in project notes; if commits are unavailable, preserve task boundaries and record verification in progress documentation instead.
