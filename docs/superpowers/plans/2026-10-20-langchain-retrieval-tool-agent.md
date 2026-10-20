# LangChain Retrieval Tool Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let LangChain chat model decide when to call approved PlacidWay retrieval, while streaming safe agent activity, grounded answer text, and citations to the UI.

**Architecture:** `/api/chat` will invoke a bounded LangChain tool-calling agent instead of retrieving evidence before model execution. `search_placidway_knowledge` owns embedding, direct Supabase table reads, similarity filtering, and safe evidence serialization. Agent events are translated to SSE and rendered as collapsible activity in the chat UI; hidden reasoning and internal errors never leave the server.

**Tech Stack:** Next.js 16, TypeScript, LangChain `ChatOpenAI`, LangChain tools, Supabase JS direct table queries, Vitest, SSE.

**Spec:** `docs/superpowers/specs/2026-10-20-langchain-retrieval-tool-agent-design.md`

## Global Constraints

- Use only seven configured PlacidWay source URLs.
- Do not add Supabase RPC/function calls; retrieval and writes stay in project logic.
- Maximum one retrieval tool call per request.
- Never expose chain-of-thought, system prompt, credentials, stack traces, provider errors, or internal DB details.
- Preserve controlled unknown fallback: `I could not find that information in the approved PlacidWay content. Please contact PlacidWay for a free quote.`
- Preserve SSE `delta`, `citation`, `done`, and generic `error` behavior.
- Tool output may expose only approved content and citation metadata.

## Review Focus

- Tool call loop or repeated calls: test maximum one tool invocation and bounded execution.
- Model emits malformed tool arguments: test validation and safe error handling.
- Direct Supabase embedding arrives as pgvector string: test parsing and similarity calculation.
- Greeting skips retrieval but still streams a complete answer.
- Tool returns no qualifying evidence: test controlled fallback and no unsupported answer.

---

### Task 1: Define agent event and tool result contracts

**Files:**
- Create: `src/lib/agent/types.ts`
- Test: `tests/agent/types.test.ts`

**Interfaces:**
- Produces `AgentEvent` union with `thinking`, `tool_start`, `tool_result`, `answer_start`, `delta`, `citation`, `done`, and `error`.
- Produces `ToolEvidence` with `sourceId`, `title`, `url`, `section`, `content`, and `similarity`.

- [ ] **Step 1: Write failing tests** for event shape and safe tool evidence serialization.
- [ ] **Step 2: Run `bun test tests/agent/types.test.ts` and verify failure.**
- [ ] **Step 3: Implement exact types and bounded serialization helpers in `src/lib/agent/types.ts`.**
- [ ] **Step 4: Run targeted test and verify pass.**
- [ ] **Step 5: Commit** `feat: define agent event contracts`.

### Task 2: Extract direct retrieval into LangChain tool

**Files:**
- Create: `src/lib/agent/tools.ts`
- Modify: `src/lib/db/repositories.ts`
- Test: `tests/agent/tools.test.ts`

**Interfaces:**
- `createPlacidWaySearchTool(deps): StructuredTool`.
- Tool input schema `{ query: string }`.
- Tool returns bounded JSON evidence list and retrieval counts.

- [ ] **Step 1: Write failing tests** for factual query retrieval, empty result, malformed query, approved metadata, and pgvector string parsing.
- [ ] **Step 2: Run `bun test tests/agent/tools.test.ts` and verify expected failures.**
- [ ] **Step 3: Implement tool using LangChain schema/tool API, `getEmbeddings().embedQuery`, and repository direct-table retrieval. Enforce one query, max length, active rows, similarity threshold, and seven-source allowlist.**
- [ ] **Step 4: Remove RPC fallback from retrieval path and keep direct table query as required production path.**
- [ ] **Step 5: Run targeted tool and repository tests.**
- [ ] **Step 6: Commit** `feat: add PlacidWay retrieval tool`.

### Task 3: Implement bounded LangChain agent orchestration

**Files:**
- Create: `src/lib/agent/chat-agent.ts`
- Modify: `src/lib/constants.ts`
- Test: `tests/agent/chat-agent.test.ts`

**Interfaces:**
- `streamAgentAnswer(input): AsyncGenerator<AgentEvent>`.
- Input includes question, bounded history, chat model, retrieval tool, and abort signal.
- Agent emits safe events only; tool execution count is capped at one.

- [ ] **Step 1: Write failing tests** for greeting without tool, factual question with one tool call, empty evidence fallback, second-call rejection, and provider failure mapping.
- [ ] **Step 2: Run targeted tests and verify failures.**
- [ ] **Step 3: Implement model/tool binding and event translation. Use centralized system prompt plus explicit tool-selection instructions; do not emit hidden reasoning.**
- [ ] **Step 4: Enforce maximum one tool call and bounded tool input/output.**
- [ ] **Step 5: Run targeted tests and verify pass.**
- [ ] **Step 6: Commit** `feat: add bounded LangChain chat agent`.

### Task 4: Replace API retrieval path with agent SSE

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/chat/answer.ts` only if shared citation/fallback helpers require it.
- Test: `tests/api/chat.test.ts`, `tests/api/chat-grounding.test.ts`

**Interfaces:**
- `/api/chat` keeps existing request validation and returns `text/event-stream`.
- SSE maps agent events to safe JSON payloads.

- [ ] **Step 1: Write failing API tests** for activity sequence, no-tool greeting, tool activity, citation, done event, abort, and generic error.
- [ ] **Step 2: Run API tests and verify failures.**
- [ ] **Step 3: Wire route to `streamAgentAnswer`; construct Supabase client with both `from` and existing required client methods; preserve chat outcome logging.**
- [ ] **Step 4: Ensure raw tool traces and provider details stay server-side.**
- [ ] **Step 5: Run API tests and existing chat tests.**
- [ ] **Step 6: Commit** `feat: stream agent activity from chat API`.

### Task 5: Render collapsible agent activity in chat UI

**Files:**
- Modify: `src/components/chat/chat-shell.tsx`
- Test: `tests/components/chat-shell.test.tsx` or existing component test location.

**Interfaces:**
- UI consumes SSE event union from `src/lib/agent/types.ts`.
- UI stores activity entries separately from final answer text.

- [ ] **Step 1: Write failing UI tests** for activity rendering, collapse/expand, tool result counts, citation rendering, error state, and final answer preservation.
- [ ] **Step 2: Run UI tests and verify failures.**
- [ ] **Step 3: Implement `Agent activity` collapsible section with status labels: `Understood question`, `Searching approved PlacidWay content`, `Found relevant sources`, and `Preparing grounded answer`.**
- [ ] **Step 4: Keep final answer primary; never render raw reasoning or internal errors.**
- [ ] **Step 5: Run UI tests and verify pass.**
- [ ] **Step 6: Commit** `feat: show agent activity in chat UI`.

### Task 6: Full verification and regression cleanup

**Files:**
- Modify: tests and implementation files only where failures identify concrete regressions.
- Verify: all changed files and existing test suite.

- [ ] **Step 1: Run `bun run typecheck`.**
- [ ] **Step 2: Run `bun run lint`.**
- [ ] **Step 3: Run targeted agent/API/UI tests.**
- [ ] **Step 4: Run `bun test` and record every failure before fixing.**
- [ ] **Step 5: Run local dev server and verify factual question produces activity, grounded answer, and citation; verify greeting can skip retrieval.**
- [ ] **Step 6: Run manual out-of-scope query and verify controlled fallback.**
- [ ] **Step 7: Commit** `test: verify LangChain retrieval agent flow`.
