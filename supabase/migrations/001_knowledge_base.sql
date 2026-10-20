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
