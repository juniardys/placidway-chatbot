# PlacidWay Knowledge Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js PlacidWay knowledge chatbot with grounded RAG answers, SSE streaming, Supabase pgvector storage, controlled ingestion, and polished public chat UI.

**Architecture:** Next.js App Router runs under Bun and owns public UI and server API routes. A shared deterministic refresh service is triggered by both a secured manual endpoint and a persistent Bun cron using `node-cron`; it fetches only allowlisted sources and activates a new snapshot atomically. Chat requests retrieve active chunks, apply explicit answer policy, then stream a grounded answer while attaching citations from database metadata.

**Tech Stack:** Bun, Next.js, TypeScript, Tailwind CSS, LangChain JS, `node-cron`, OpenAI-compatible 9router endpoint, Supabase Postgres, pgvector, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-placidway-chatbot-design.md`

**Assessment reference:** `C:\Users\junia\Downloads\AI Automation Assessment Website Knowledge Chatbot.pdf`

**Implementation notes:** `docs/IMPLEMENTATION-NOTES.md`

## Global Constraints

- Use `LLM_ENDPOINT` and `LLM_API_KEY` for OpenAI-compatible chat and embeddings.
- Use `EMBEDDING_MODEL=sumo/text-embedding-3-small` and `EMBEDDING_DIMENSIONS=1536`.
- Store embeddings as `vector(1536)`.
- Ingestion may fetch exactly seven configured allowlisted URLs from the assessment PDF; never crawl discovered links.
- Deployment must provide a public URL and remain available for at least seven days after submission.
- README, test answers for eight assessment categories, and known limitations/write-up are deliverables.
- Respect robots.txt, use an identifiable User-Agent, and pace source requests at approximately one request per second.
- Use `INGESTION_CRON_SCHEDULE=0 3 * * *` and `INGESTION_CRON_TIMEZONE=UTC` defaults.
- Run project with Bun (`bun install`, `bun run`, `bun test`).
- Use `noOverlap: true` for node-cron and prevent manual/cron refresh overlap through the shared refresh service.
- Keep active previous snapshot when refresh fails.
- Keep secrets server-only and provide `.env.example` without credentials.
- Generate citations from stored source metadata, never model-invented URLs.
- Do not provide diagnosis, individualized safety claims, appointment promises, or unsupported prices.
- Do not use `transition: all`; use Tailwind and existing project styling conventions only.

## Review Focus

- Invalid or missing cron env must fail safely at startup and must not silently schedule an unintended refresh; test in Task 3.
- Two refresh triggers arriving together must produce one refresh execution and preserve consistent active snapshot state; test in Task 5.
- A partial/total source failure must not deactivate the last successful snapshot; test in Task 5.
- SSE disconnects and provider failures must close streams without leaking secrets or leaving the UI permanently loading; test in Task 7.
- A retrieved chunk with missing or malformed citation metadata must never produce an invented citation; test in Task 6.

---

### Task 1: Next.js scaffold and runtime configuration

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.example`, `.gitignore`, `README.md`
- Test: `tests/config/env.test.ts`

**Interfaces:**

- Produces a runnable Next.js App Router project and validated server environment configuration.
- Exposes `getServerEnv(): ServerEnv` for server-only modules.

- [ ] **Step 1: Write failing env tests** for required variables, defaults, and numeric embedding dimension `1536`.
- [ ] **Step 2: Run `bun test tests/config/env.test.ts` and verify failure.**
- [ ] **Step 3: Scaffold Next.js and implement `getServerEnv(): ServerEnv` with Zod or equivalent validation.** Include `LLM_ENDPOINT`, `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `DATABASE_URL`, `REFRESH_SECRET`, `INGESTION_CRON_SCHEDULE`, and `INGESTION_CRON_TIMEZONE`.
- [ ] **Step 4: Add `.env.example` with placeholders only and initial accessible shell UI.**
- [ ] **Step 5: Run `bun test tests/config/env.test.ts` and `bun run build`; expect PASS and successful build with absent optional runtime secrets handled only where intended.**

### Task 2: Database migration and repository boundary

**Files:**

- Create: `supabase/migrations/001_knowledge_base.sql`
- Create: `src/lib/db/client.ts`, `src/lib/db/repositories.ts`, `src/lib/db/types.ts`
- Test: `tests/db/repositories.test.ts`

**Interfaces:**

- Produces `getActiveChunks(queryEmbedding, limit): Promise<RetrievedChunk[]>`.
- Produces source/snapshot/chunk write and activation methods used by ingestion.
- Produces `logChatOutcome(input): Promise<void>`.

- [ ] **Step 1: Write failing repository contract tests** using a mocked Postgres boundary; assert metadata preservation and active-only retrieval.
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Add pgvector extension and tables `knowledge_sources`, `knowledge_snapshots`, `knowledge_chunks`, and `chat_logs`; use `vector(1536)` and indexes appropriate for active retrieval.**
- [ ] **Step 4: Implement repository methods with parameterized SQL and explicit `RetrievedChunk` metadata.**
- [ ] **Step 5: Run migration validation and repository tests; expect PASS.**

### Task 3: LangChain provider and node-cron scheduler

**Files:**

- Create: `src/lib/llm/client.ts`, `src/lib/llm/embeddings.ts`
- Create: `src/lib/ingestion/cron.ts`, `src/instrumentation.ts`
- Modify: `package.json`
- Test: `tests/llm/provider-config.test.ts`, `tests/ingestion/cron.test.ts`

**Interfaces:**

- Produces `getChatModel(): ChatOpenAI` configured with custom `baseURL`.
- Produces `getEmbeddings(): OpenAIEmbeddings` configured with custom `baseURL`, model, and dimension `1536`.
- Produces `startIngestionCron(refresh: () => Promise<void>): ScheduledTask`.

- [ ] **Step 1: Write failing tests** asserting both LangChain clients use `LLM_ENDPOINT`, selected model env values, and that cron uses schedule/timezone env with `noOverlap: true`.
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Add LangChain and `node-cron` dependencies with `bun add`; implement provider factories without making network calls during import.**
- [ ] **Step 4: Implement cron startup with default `0 3 * * *`, default `UTC`, invalid-expression error logging, `noOverlap: true`, and execution failure handling.**
- [ ] **Step 5: Start cron from Next server instrumentation only in server runtime; avoid browser imports.**
- [ ] **Step 6: Run targeted tests and typecheck; expect PASS.**

### Task 4: Source allowlist, robots, fetch, and normalization

**Files:**

- Create: `src/lib/ingestion/sources.ts`, `src/lib/ingestion/fetcher.ts`, `src/lib/ingestion/normalize.ts`
- Create: `src/config/sources.ts`
- Test: `tests/ingestion/sources.test.ts`, `tests/ingestion/normalize.test.ts`

**Interfaces:**

- Produces `assertAllowedSource(url): AllowedSource`.
- Produces `fetchSource(source): Promise<RawSnapshot>`.
- Produces `normalizeSource(raw): NormalizedDocument`.

- [ ] **Step 1: Write failing tests** for exact allowlist rejection, robots denial, User-Agent, one-second pacing injection, title/heading extraction, Markdown cleanup, and metadata retention.
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Add exactly seven source configuration entries, with values supplied by assessment configuration rather than discovered links.**
- [ ] **Step 4: Implement robots.txt check, fetcher, pacing abstraction, and normalized Markdown output.**
- [ ] **Step 5: Run targeted tests; expect PASS.**

### Task 5: Refresh service and snapshot activation

**Files:**

- Create: `src/lib/ingestion/refresh.ts`, `src/lib/ingestion/chunk.ts`
- Create: `src/app/api/admin/refresh/route.ts`
- Test: `tests/ingestion/refresh.test.ts`, `tests/api/admin-refresh.test.ts`

**Interfaces:**

- Produces `refreshKnowledgeBase(): Promise<RefreshResult>`.
- Manual route accepts `POST` with `Authorization: Bearer <REFRESH_SECRET>` and returns JSON status.

- [ ] **Step 1: Write failing tests** for unchanged hash skip, changed source re-index, partial failure, total failure, lock behavior, secret rejection, and previous active snapshot preservation.
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Implement semantic chunking that preserves heading context and pricing/package/disclaimer sections.**
- [ ] **Step 4: Implement refresh transaction: fetch all seven, normalize/hash, skip unchanged, embed changed chunks, persist raw/normalized records, activate only after complete success.**
- [ ] **Step 5: Add in-process refresh lock shared by cron and manual route.**
- [ ] **Step 6: Implement secured route with safe error responses and no secret logging.**
- [ ] **Step 7: Run targeted tests; expect PASS.**

### Task 6: Retrieval, policy, grounded answer generation, and SSE API

**Files:**

- Create: `src/lib/retrieval/retrieve.ts`, `src/lib/policy/answer-policy.ts`, `src/lib/chat/answer.ts`
- Create: `src/app/api/chat/route.ts`
- Test: `tests/api/chat.test.ts`, `tests/policy/answer-policy.test.ts`

**Interfaces:**

- Produces `retrieveEvidence(question, history): Promise<RetrievedChunk[]>`.
- Produces `classifyQuestion(question): PolicyDecision`.
- Produces `streamGroundedAnswer(input): AsyncIterable<ChatEvent>`.
- Route emits SSE events `{ type: "delta", text }`, `{ type: "citations", citations }`, `{ type: "done" }`, or `{ type: "error", message }`.

- [ ] **Step 1: Write failing boundary tests** for factual citations, unknown fallback, quote suggestion, pricing qualifiers, comparison evidence, appointment refusal, out-of-scope refusal, medical disclaimer, trick premise rejection, follow-up context, malformed citation metadata, provider failure, and SSE event ordering.
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Implement retrieval with embedding query, active vector search, relevance threshold, bounded history, and source metadata.**
- [ ] **Step 4: Implement policy decisions before model generation; unknown/policy refusals must not ask model to invent facts.**
- [ ] **Step 5: Implement grounded LangChain prompt and stream adapter; citations come only from retrieved metadata.**
- [ ] **Step 6: Implement route validation, SSE headers, abort handling, logging, and chat outcome persistence.**
- [ ] **Step 7: Run targeted tests; expect PASS.**

### Task 7: Public chat UI and end-to-end behavior

**Files:**

- Modify: `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/components/chat/chat-shell.tsx`, `src/components/chat/message-list.tsx`, `src/components/chat/message-composer.tsx`, `src/components/chat/citation-list.tsx`
- Test: `tests/e2e/chat.spec.ts`

**Interfaces:**

- UI consumes `/api/chat` SSE contract from Task 6.
- UI displays messages, streaming state, error state, retry, and citation links.

- [ ] **Step 1: Write Playwright tests** for submit, streamed answer, citation opening, loading state, error state, keyboard submit, and mobile layout basics.
- [ ] **Step 2: Run Playwright and verify failure before implementation.**
- [ ] **Step 3: Implement accessible chat components with keyboard support, focus-visible state, 40px+ desktop controls, responsive layout, and safe Markdown/text rendering.**
- [ ] **Step 4: Apply polish rules: concentric radii, restrained shadows, exact transition properties, `active:scale-[0.96]`, balanced headings, readable body wrapping, and no `transition-all`.**
- [ ] **Step 5: Run Playwright and inspect loading, error, empty, focus, and streaming states; expect PASS.**

### Task 8: Documentation and acceptance suite

**Files:**

- Modify: `README.md`
- Create: `tests/acceptance/assessment-questions.md`, `docs/acceptance/answers.md`
- Test: full test suite and production build

**Interfaces:**

- Documents local setup, env vars, migrations, seven source configuration, cron operation, manual refresh, SSE contract, deployment runtime requirement, limitations, provider selection, and all locked decisions in `docs/IMPLEMENTATION-NOTES.md`.

- [ ] **Step 1: Add repeatable eight-category assessment questions and answer recording template.**
- [ ] **Step 2: Document persistent Bun runtime requirement for internal `node-cron`, `INGESTION_CRON_SCHEDULE`, `INGESTION_CRON_TIMEZONE`, Bun commands, and manual refresh security.**
- [ ] **Step 3: Run `bun test`, `bun run lint`, `bun run typecheck`, and `bun run build`; fix failures.**
- [ ] **Step 4: Run Playwright acceptance suite against production-like server; record results in `docs/acceptance/answers.md`.**
