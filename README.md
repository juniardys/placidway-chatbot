# PlacidWay Knowledge Chatbot

A grounded chatbot that answers questions about PlacidWay treatments, packages, and prices using only seven approved PlacidWay pages. Every factual answer is backed by retrieved page content and cites its source pages. Questions the content cannot answer get an honest "not in the content" reply and a free-quote form.

- **Live demo:** <https://chatbot.juunsdev.my.id/>
- **Test results (8 assessment questions + extras):** [`tests/acceptance/test-results.md`](tests/acceptance/test-results.md)

## Features

- Retrieval-augmented answers from 7 allowlisted PlacidWay pages (no crawling beyond them).
- Source citations computed from retrieved database metadata, never written by the model.
- Token-by-token streaming over SSE, with live "searching / found N sources" activity.
- Follow-up questions resolved from chat history ("what about in Turkey?").
- Answers in the user's language (tested with Spanish and Arabic) from English source pages.
- Policy guardrails: no booking, no off-topic answers, no medical advice, no invented or confirmed-but-unsupported prices.
- Lead capture: a name/email "free quote" form appears when the user asks for a quote or when the content cannot answer.
- Content-gap log: unanswered questions are recorded and grouped in a `content_gaps` view.
- Persistent chat sessions (stored in Supabase).
- Automatic daily content refresh (cron) plus a manual "Refresh content" button.

## Tools and models

| Layer | Choice |
| --- | --- |
| Runtime / package manager | Bun |
| Web framework | Next.js (App Router) + TypeScript, Tailwind CSS |
| AI orchestration | LangChain JS (`@langchain/openai`, tool calling) |
| LLM | `LLM_MODEL` via an OpenAI-compatible endpoint (9router). `<ACTUAL_MODEL_NAME>` |
| Embeddings | `text-embedding-3-small`, 1536 dimensions (same endpoint) |
| Vector store / DB | Supabase Postgres + pgvector (HNSW index, cosine distance) |
| Scheduling | `node-cron` inside the Next.js server process (`src/instrumentation.ts`) |
| Validation | Zod |
| Tests | `bun test` |

## Architecture

```
Browser (chat UI)
   │  POST /api/chat  (question + history)          ◄── SSE stream: thinking / tool_start /
   ▼                                                    tool_result / delta / citation / lead_offer / done
Next.js route ── LangChain agent
                   1. Decide: model chooses one tool
                      • search_placidway_knowledge(query)  – query rewritten as standalone English
                      • request_free_quote()                – quote / contact / booking requests
                      • no tool                             – off-topic, answered as a polite refusal
                   2. Retrieve: embed query → match_knowledge_chunks (pgvector, top-k + min score)
                   3. Answer: stream a reply grounded only in the returned evidence
                   4. Cite: pick the source pages the answer actually used
                   │
                   ▼
              Supabase Postgres
                knowledge_sources / knowledge_snapshots / knowledge_chunks (vector(1536))
                chat_sessions / chat_messages, chat_logs, leads, content_gaps (view)

Ingestion (cron daily + POST /api/refresh)
   allowlist (7 URLs) → robots.txt check → fetch (1 req/s, identifiable User-Agent)
   → HTML to Markdown, strip site chrome → SHA-256 hash → chunk by heading
   → embed only changed pages → write new snapshot → activate only if all 7 succeed
```

Key design decisions:

- **Grounding is enforced in code, not only in the prompt.** If retrieval returns no evidence, the model is never asked to answer from general knowledge; it only produces a short "not available" message. Citations come from database rows, so the model cannot invent URLs.
- **Gap detection.** The model prefixes replies with `[[NO_ANSWER]]` or `[[PARTIAL_ANSWER]]` when the evidence does not cover the question. The server strips the marker before streaming, logs the question as unanswered, drops citations for full gaps, and shows the quote form.
- **Snapshot-based refresh.** A failed refresh never replaces the active knowledge base; the previous snapshot keeps serving answers. A process lock and `noOverlap` prevent overlapping runs.
- **Prompt-injection hygiene.** User text and retrieved page text are treated as untrusted data; secrets, raw provider errors, and stack traces are never streamed to the browser.

### Project layout

```
src/app/api/chat/          SSE chat endpoint + session endpoints
src/app/api/refresh/       manual knowledge-base refresh
src/app/api/leads/         free-quote lead capture
src/components/chat/       chat UI, agent activity, lead form, Markdown renderer
src/config/sources.ts      the 7 allowlisted source pages
src/lib/agent/             agent loop, search + quote tools, citation selection
src/lib/ingestion/         fetcher, normalizer, chunker, refresh pipeline, cron
src/lib/db/                Supabase client and repositories
supabase/migrations/       schema (001 knowledge base, 002 sessions, 003 leads + content gaps)
tests/                     unit, API, policy, and acceptance tests
```

## Setup

### Prerequisites

- Bun 1.x
- A Supabase project with the `vector` extension available
- An OpenAI-compatible endpoint that serves a chat model (with tool calling) and `text-embedding-3-small`

### 1. Install

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `LLM_ENDPOINT` | OpenAI-compatible base URL (e.g. `https://.../v1`) |
| `LLM_API_KEY` | API key for that endpoint (server-only) |
| `LLM_MODEL` | Chat model name; must support tool calling |
| `EMBEDDING_MODEL` | Embedding model (default `sumo/text-embedding-3-small`) |
| `EMBEDDING_DIMENSIONS` | Must be `1536` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe for the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for ingestion, retrieval, sessions, and leads |
| `INGESTION_CRON_SCHEDULE` | Cron expression for auto refresh (default `0 3 * * *`) |
| `INGESTION_CRON_TIMEZONE` | Cron timezone (default `UTC`) |

Optional tuning: `RETRIEVAL_TOP_K` (default 6), `RETRIEVAL_MIN_SCORE` (default 0.5), `MAX_HISTORY_MESSAGES` (default 10).

Never expose `LLM_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.

### 3. Create the database schema

Run the migrations in order, either with the Supabase CLI:

```bash
supabase db push
```

or by pasting `supabase/migrations/001_*.sql`, `002_*.sql`, and `003_*.sql` into the Supabase SQL editor.

### 4. Run

```bash
bun run dev
```

Open <http://localhost:3000>.

### 5. Load the knowledge base

Click **Refresh content** in the chat UI, or:

```bash
curl -X POST http://localhost:3000/api/refresh
```

`200` means refreshed or unchanged, `409` means a refresh is already running, and `500` means it failed (the previous snapshot stays active). After that, the cron job refreshes content on the configured schedule.

### 6. Verify

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

## API

`POST /api/chat`

```json
{ "question": "How much does ... cost?", "history": [{ "role": "user", "content": "..." }], "sessionId": "optional" }
```

The response is `text/event-stream`. Each event is one JSON `data:` line, for example `{"type":"delta","text":"..."}`, `{"type":"citation","citation":{...}}`, `{"type":"lead_offer"}`, `{"type":"done"}`, or `{"type":"error","message":"..."}`.

`POST /api/leads` takes `{ name, email, message?, sessionId? }`. `POST /api/refresh` takes no body.

Content gaps can be reviewed in SQL:

```sql
select * from content_gaps;
```

## Deployment

`node-cron` needs one long-lived server process, so deploy to a persistent host (VPS, Docker with a restart policy, Railway, Render, Fly.io, or similar) rather than scale-to-zero serverless functions:

```bash
bun run build
bunx next start
```

Set the same environment variables on the host, run the migrations against the production Supabase project, then trigger one refresh. If you run more than one app instance, enable cron on only one of them.

## Known limitations

See the short write-up submitted with this repository. In summary: the knowledge base covers only seven pages, so many questions correctly end in "not in the content"; retrieval is vector-only; citations are chosen by keyword overlap and can include an extra related page; the refresh endpoint is public; and cron requires a single persistent process.
