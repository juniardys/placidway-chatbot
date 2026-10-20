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

create or replace function insert_source_snapshot(p_id uuid, p_source_id text, p_raw_content text, p_normalized_markdown text, p_content_hash text, p_status text default 'pending')
returns table(id uuid) language sql security definer as $$
  insert into knowledge_snapshots(id, source_id, raw_content, normalized_markdown, content_hash, status)
  values (coalesce(p_id, gen_random_uuid()), p_source_id, p_raw_content, p_normalized_markdown, p_content_hash, p_status)
  returning knowledge_snapshots.id;
$$;

create or replace function insert_knowledge_chunks(p_chunks jsonb)
returns void language plpgsql security definer as $$
begin
  insert into knowledge_chunks(source_id, snapshot_id, text_content, embedding, section, content_hash)
  select x.source_id, x.snapshot_id, x.text_content, x.embedding::vector, x.section, x.content_hash
  from jsonb_to_recordset(p_chunks) as x(source_id text, snapshot_id uuid, text_content text, embedding jsonb, section text, content_hash text);
end;
$$;

create or replace function activate_snapshot(p_snapshot_id uuid)
returns void language sql security definer as $$
  update knowledge_snapshots set active = (id = p_snapshot_id), status = case when id = p_snapshot_id then 'active' else status end
  where source_id = (select source_id from knowledge_snapshots where id = p_snapshot_id);
  update knowledge_chunks set active = (snapshot_id = p_snapshot_id)
  where source_id = (select source_id from knowledge_snapshots where id = p_snapshot_id);
$$;

create or replace function log_chat_outcome(p_question text, p_status text, p_confidence numeric default null)
returns void language sql security definer as $$
  insert into chat_logs(question, answer_status, confidence)
  values (p_question, p_status, p_confidence);
$$;
