create extension if not exists vector;

create table if not exists knowledge_sources (
  id text primary key,
  url text unique not null,
  title text not null,
  page_type text not null,
  active boolean not null default true,
  latest_content_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists knowledge_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id text references knowledge_sources(id),
  raw_content text not null,
  normalized_markdown text not null,
  content_hash text not null,
  status text not null,
  active boolean not null default false,
  error text,
  created_at timestamptz default now()
);

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id text references knowledge_sources(id),
  snapshot_id uuid references knowledge_snapshots(id),
  text_content text not null,
  embedding vector(1536),
  section text,
  content_hash text,
  active boolean default false,
  metadata jsonb not null default '{}'
);

create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer_status text not null,
  confidence numeric,
  created_at timestamptz default now()
);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold real,
  match_count integer
)
returns table (
  id uuid,
  content text,
  source_id text,
  title text,
  url text,
  page_type text,
  section text,
  fetched_at timestamptz,
  content_hash text,
  similarity real
)
language sql stable
as $$
  select
    c.id,
    c.text_content,
    c.source_id,
    s.title,
    s.url,
    s.page_type,
    c.section,
    sn.created_at,
    c.content_hash,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from knowledge_chunks c
  join knowledge_sources s on s.id = c.source_id
  join knowledge_snapshots sn on sn.id = c.snapshot_id
  where c.active = true
    and sn.status = 'active'
    and sn.active = true
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

create or replace function log_chat_outcome(p_question text, p_status text, p_confidence numeric default null)
returns void language sql security definer as $$
  insert into chat_logs(question, answer_status, confidence)
  values (p_question, p_status, p_confidence);
$$;
