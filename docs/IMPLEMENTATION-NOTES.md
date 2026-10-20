# Implementation Notes — PlacidWay Chatbot

Dokumen ini melengkapi PRD, design spec, dan implementation plan. Sesi implementasi baru wajib membaca semua dokumen berikut:

- `PRD.md`
- `docs/superpowers/specs/2026-10-20-placidway-chatbot-design.md`
- `docs/superpowers/plans/2026-10-20-placidway-chatbot.md`
- `docs/IMPLEMENTATION-NOTES.md`

## Locked decisions

- Framework: Next.js App Router + TypeScript.
- UI styling: Tailwind CSS.
- AI orchestration: LangChain JS.
- Chat transport: SSE over `POST /api/chat`.
- LLM and embeddings: same OpenAI-compatible 9router endpoint.
- Embedding model: `sumo/text-embedding-3-small`.
- Embedding dimension: `1536`.
- Vector column: `vector(1536)`.
- Supabase integration: `@supabase/supabase-js` + `@supabase/ssr` with public URL/key and cookie-based SSR session refresh.
- RAG vector database: PostgreSQL + pgvector is not configured in current runtime; `DATABASE_URL` is intentionally removed until that adapter is activated.
- Runtime/package manager: Bun.
- Automatic refresh: `node-cron` in persistent Bun server runtime.
- Manual refresh: `POST /api/admin/refresh`.
- Cron defaults: `0 3 * * *`, timezone `UTC`.
- Cron overlap: `noOverlap: true` plus shared refresh lock.
- Active snapshot stays available after failed refresh.
- Seven source pages only. No discovered-link crawling.
- Secrets remain server-only.
- Assistant output uses sanitized Markdown rendering.
- Empty knowledge base returns controlled unknown response; it must not call the LLM to invent an answer.
- Citations are generated only from retrieved database metadata.

## Required values before real ingestion/deployment

These values are intentionally not invented:

- Seven literal source URLs from the assessment/shared content.
- `LLM_MODEL` supported by 9router.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Supabase SSR/Data API.
- New rotated `LLM_API_KEY`.
- `REFRESH_SECRET`.
- Deployment target and public hostname.

Implementation may proceed with placeholders and mocked/seeded tests. Real ingestion must refuse to start if source URLs are placeholders or if required production env values are missing.

## Source allowlist

Configuration must contain exactly seven entries with stable IDs:

1. `clinic-profile` — ITC Immunity Therapy Center clinic profile.
2. `adenocarcinoma-package` — Alternative Adenocarcinoma Cancer Treatment in Tijuana.
3. `adrenal-package` — Alternative Adrenal Cancer Treatment in Tijuana.
4. `anal-package` — Alternative Anal Cancer Treatment in Tijuana.
5. `clinic-videos` — ITC Tijuana Videos — Alternative Cancer Treatment.
6. `price-list` — ITC Immunity Therapy Center — Price List.
7. `price-comparison` — Alternative Medicine Cost Abroad — Compare Prices 2026.

Each entry must include `id`, `url`, `title`, and `pageType`. Placeholder URLs must be rejected by production refresh validation.

## Environment contract

```env
LLM_ENDPOINT=https://ai.juunsdev.my.id/v1
LLM_API_KEY=
LLM_MODEL=
EMBEDDING_MODEL=sumo/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
REFRESH_SECRET=
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
INGESTION_CRON_SCHEDULE=0 3 * * *
INGESTION_CRON_TIMEZONE=UTC
INGESTION_USER_AGENT=PlacidWayKnowledgeBot/1.0 (+contact URL or email)
RETRIEVAL_TOP_K=6
RETRIEVAL_MIN_SCORE=0.72
MAX_HISTORY_MESSAGES=10
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`LLM_ENDPOINT` must be normalized to avoid duplicate `/v1`. `EMBEDDING_DIMENSIONS` must equal `1536`. Numeric values must be validated at startup.

## SSE contract

Response headers:

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Each event is JSON in one `data:` line followed by a blank line:

```json
{"type":"delta","text":"..."}
{"type":"citations","citations":[{"sourceId":"price-list","title":"...","url":"https://..."}]}
{"type":"done"}
{"type":"error","message":"Safe user-facing error"}
```

Request body:

```json
{
  "question": "string, 1–2000 chars",
  "history": [{ "role": "user|assistant", "content": "string, max 4000 chars" }]
}
```

The route validates input, limits history to `MAX_HISTORY_MESSAGES`, and never streams secrets, raw prompts, stack traces, or raw provider errors.

## Policy behavior

- Factual answer: requires relevant evidence and at least one valid citation.
- Missing evidence: say the answer is not available in the PlacidWay content and suggest requesting a free quote.
- Empty KB: same controlled unknown response, with operational log only.
- Price missing: say price is not listed; do not estimate; suggest quote.
- Price premise unsupported: explicitly do not confirm it.
- Comparison: answer only when evidence supports both compared locations/treatments.
- Appointment: state that chatbot cannot book appointments; suggest PlacidWay contact/quote path if known in evidence, otherwise free quote.
- Out of scope: polite refusal; no web search.
- Medical advice: no diagnosis, individualized safety claim, or treatment recommendation; suggest consulting a qualified doctor and add a short disclaimer.
- Language: answer in user language when model supports it, while preserving source meaning and citations.

## Refresh contract

Both cron and manual endpoint call:

```ts
refreshKnowledgeBase(): Promise<RefreshResult>
```

Refresh steps:

1. Acquire process lock; return `skipped` if already running.
2. Validate all seven exact allowlist entries.
3. Check robots.txt.
4. Fetch sequentially with approximately one-second spacing and explicit User-Agent.
5. Preserve raw response.
6. Normalize to Markdown and calculate SHA-256 hash.
7. Reuse unchanged active chunks.
8. Embed only changed documents.
9. Write a new snapshot.
10. Activate new snapshot only when all required sources complete successfully.
11. On any failure, keep old active snapshot and return failure details without exposing source secrets.
12. Release lock in `finally`.

Manual endpoint:

```http
POST /api/admin/refresh
Authorization: Bearer <REFRESH_SECRET>
```

Return `401` for missing/invalid secret, `409` for active refresh if not safely skipped, `200` for successful or unchanged refresh, and `500` for failed refresh while old snapshot remains active.

## Runtime and deployment

`node-cron` requires one persistent Bun server process. Bun runs the Node-compatible `node-cron` package. Do not claim cron works on scale-to-zero serverless hosting. Deployment must use one of:

- persistent Node host,
- Docker process with restart policy,
- VPS/process manager,
- platform explicitly supporting long-lived Node processes.

If multiple app instances are deployed, run cron in one dedicated worker or enable documented distributed coordination. Do not let every replica ingest independently.

Assessment deployment requirement: provide a public URL and keep it available for at least seven days after submission. Deployment credentials and URL remain runtime inputs, not source-controlled values.

## Required deliverables

- Working repository.
- `.env.example` with no credentials.
- README: setup, architecture, provider/model choices, migration, ingestion, cron, manual refresh, SSE, deployment, limitations.
- Supabase migration.
- Eight-category test answer file: `docs/acceptance/answers.md`.
- Short known-limitations/future-improvements write-up.
- Public deployment URL after credentials and hosting target are supplied.

## Verification gate

Before claiming implementation complete, run:

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

Then verify manually:

- Empty KB fallback.
- Streaming answer and citations.
- Unknown question.
- Price qualifier preservation.
- Comparison evidence requirement.
- Appointment refusal.
- Out-of-scope refusal.
- Medical disclaimer.
- Trick-price rejection.
- Manual refresh auth and failure preservation.
- Cron startup in persistent Node runtime.
