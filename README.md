# PlacidWay Knowledge Chatbot

# PlacidWay Knowledge Chatbot

Bun + Next.js grounded chatbot with Supabase SSR helpers.

## Supabase setup

Install packages with Bun:

```bash
bun add @supabase/supabase-js @supabase/ssr
```

Set public Supabase variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Helpers live in:

- `utils/supabase/server.ts` — Server Components and server-side Supabase client.
- `utils/supabase/client.ts` — browser client.
- `utils/supabase/middleware.ts` — cookie/session refresh implementation.
- `src/middleware.ts` — middleware entry point.
- `/todos` — example Supabase Data API query.

The publishable key is safe for browser use. Never expose service-role keys, database passwords, or LLM keys.

`DATABASE_URL` is intentionally not part of the current environment contract. The active setup uses Supabase SSR/Data API. PostgreSQL/pgvector retrieval remains pending until its server-side adapter is activated.

Copy `.env.example` to `.env.local`; production ingestion still requires seven real source URLs and runtime credentials.
