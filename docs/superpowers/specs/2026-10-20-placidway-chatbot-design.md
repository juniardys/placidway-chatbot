# PlacidWay Knowledge Chatbot — Design Specification

## Assessment reference

This design incorporates requirements from:

`C:\Users\junia\Downloads\AI Automation Assessment Website Knowledge Chatbot.pdf`

The assessment confirms seven approved source pages, the eight evaluation categories, public deployment for at least seven days, required README/test-answer deliverables, and the 45-minute walkthrough constraint. The assessment PDF provides page titles rather than literal URLs; source configuration must be completed with the shared URL values before ingestion runs.

## Goal

Build a public Next.js chatbot that answers only from seven approved PlacidWay source pages, streams answers over SSE, preserves pricing qualifiers, cites stored source metadata, and declines unsupported or unsafe requests.

## Confirmed provider decision

Use the same OpenAI-compatible 9router endpoint for chat and embeddings.

```env
LLM_ENDPOINT=https://ai.juunsdev.my.id/v1
LLM_API_KEY=
LLM_MODEL=
EMBEDDING_MODEL=sumo/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
REFRESH_SECRET=
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
INGESTION_CRON_INTERVAL=0 3 * * *
```

The embedding column uses `vector(1536)`. Embedding model changes require re-embedding indexed chunks and a compatible schema migration.

## Architecture

- Next.js App Router with TypeScript.
- Tailwind CSS for the public chat interface.
- LangChain JS for OpenAI-compatible chat model, embeddings, document splitting, and retrieval orchestration.
- Supabase SSR/Data API through `@supabase/supabase-js` and `@supabase/ssr`; PostgreSQL/pgvector adapter remains pending until server-side database access is activated.
- Server-only provider and database access. No secret reaches browser code.
- Deterministic RAG flow: normalize request, classify policy, retrieve evidence, validate relevance, generate grounded answer, attach database-derived citations, stream response.

## Boundaries

### Public chat

`POST /api/chat` accepts a question and bounded conversation history. It returns an SSE stream containing answer deltas, citations, and a terminal event. Conversation history may improve query context but cannot override retrieved evidence.

### Refresh service

A shared refresh service is used by both automatic and manual triggers.

- Background `node-cron` runs under the Bun server runtime at the interval from `INGESTION_CRON_SCHEDULE` and starts only in the server process runtime.
- `POST /api/admin/refresh` requires `REFRESH_SECRET` and triggers the same service manually.
- The service fetches only the seven configured allowlisted URLs, honors robots.txt, identifies itself with a clear User-Agent, and spaces requests approximately one second apart.
- A lock prevents overlapping cron/manual refreshes.
- Failed refreshes do not replace the last successful active snapshot.
- Cron failures are logged with status and error details but do not crash the chat server.
- On serverless platforms where long-lived Node processes are not guaranteed, internal cron is not reliable; deployment must use a persistent Node runtime or external scheduler.

### Retrieval

Retrieval returns chunks with source URL, source ID, title, page type, section, fetch timestamp, content hash, and similarity score. Results below the configured relevance threshold are treated as insufficient evidence.

### Answer policy

Policy handles:

- Unknown questions: explicit uncertainty plus PlacidWay free-quote suggestion.
- Out-of-scope questions: polite refusal.
- Appointment requests: state that booking cannot be performed.
- Medical advice: no diagnosis, individualized safety claim, or treatment recommendation; add short disclaimer when relevant.
- Unsupported price premises: do not confirm the premise.
- Price answers: preserve currency, starting-from wording, package context, and inclusions.
- Comparisons: answer only when evidence exists for both sides.
- Citations: generated from stored metadata, never invented by model.

## Data model

Initial migration creates pgvector extension and tables for:

- `knowledge_sources`: allowlisted URL, title, page type, active status, latest content hash, timestamps.
- `knowledge_snapshots`: raw fetched content, normalized Markdown, content hash, fetch status, error, timestamps.
- `knowledge_chunks`: normalized chunk text, `vector(1536)` embedding, source and snapshot metadata, section, content hash, active status.
- `chat_logs`: question, answer status, confidence, and minimal metadata for unanswered/low-confidence analysis; no unnecessary personal data.

Active snapshot semantics ensure a failed refresh leaves prior active chunks available.

## Ingestion

The refresh service is the only entry point for ingestion. It can be triggered by background `node-cron` running in Bun or the secured manual endpoint.

1. Validate URL against exact allowlist.
2. Check robots.txt permission.
3. Fetch using configured User-Agent.
4. Preserve raw response.
5. Normalize HTML into Markdown and extract title/sections.
6. Hash normalized content.
7. Skip embedding when hash matches active successful snapshot.
8. Split by headings and semantic sections, preserving pricing, package, procedure, recovery, clinic, and disclaimer context.
9. Generate embeddings through `LLM_ENDPOINT/embeddings` using `EMBEDDING_MODEL`.
10. Write new snapshot/chunks transactionally and activate only after all required sources succeed.

## UI

Single responsive chat screen with:

- Welcome copy and suggested questions.
- Conversation history.
- User and assistant message styling.
- Streaming/loading state.
- Error state with retry.
- Citation links opening source pages.
- Accessible input, submit control, focus state, and keyboard submission.
- Existing styling system only: Tailwind. Use intentional spacing, concentric radii, restrained shadows, exact transition properties, minimum interactive hit areas, and no `transition: all`.

## Testing

Test externally observable seams:

- Chat API SSE format, citations, unknown fallback, safety, pricing, comparison, appointment, and follow-up behavior.
- Allowlist, normalization, metadata, unchanged-content skip, and refresh failure preservation.
- Retrieval relevance and source metadata.
- UI submit, streaming state, citation links, and error state.

Avoid assertions on internal LangChain calls, exact prompt wording, or vector-store implementation details.

## Documentation

Add README covering setup, environment variables, local development, Supabase migration, ingestion, retrieval flow, SSE contract, refresh security, deployment, limitations, and provider configuration. Add `.env.example` without credentials.

## Non-goals

No general web browsing, link crawling beyond seven URLs, appointment booking, payments, personalized diagnosis, full CMS, analytics dashboard, or production CRM.
