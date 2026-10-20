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
  source_id text not null references knowledge_sources(id),
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
  source_id text not null references knowledge_sources(id),
  snapshot_id uuid not null references knowledge_snapshots(id),
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
  where query_embedding is not null
    and match_threshold is not null and match_threshold > 0 and match_threshold <= 1
    and match_count is not null and match_count > 0
    and s.active = true
    and c.active = true
    and sn.status = 'active'
    and sn.active = true
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

create or replace function insert_source_snapshot(p_id uuid, p_source_id text, p_raw_content text, p_normalized_markdown text, p_content_hash text, p_status text default 'pending')
returns table(id uuid) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('pending', 'active', 'failed') then raise exception 'Invalid snapshot status'; end if;
  return query
    insert into knowledge_snapshots(id, source_id, raw_content, normalized_markdown, content_hash, status)
    values (coalesce(p_id, gen_random_uuid()), p_source_id, p_raw_content, p_normalized_markdown, p_content_hash, p_status)
    returning knowledge_snapshots.id;
end;
$$;

create or replace function insert_knowledge_chunks(p_chunks jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'Chunk payload must be non-empty array';
  end if;
  if exists (select 1 from jsonb_array_elements(p_chunks) x where jsonb_typeof(x->'embedding') <> 'array' or jsonb_array_length(x->'embedding') <> 1536) then
    raise exception 'Each chunk embedding must contain 1536 dimensions';
  end if;
  insert into knowledge_chunks(source_id, snapshot_id, text_content, embedding, section, content_hash)
  select x.source_id, x.snapshot_id, x.text_content, x.embedding::vector, x.section, x.content_hash
  from jsonb_to_recordset(p_chunks) as x(source_id text, snapshot_id uuid, text_content text, embedding jsonb, section text, content_hash text);
end;
$$;

create or replace function activate_snapshot(p_snapshot_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from knowledge_snapshots where id = p_snapshot_id) then raise exception 'Snapshot not found'; end if;
  update knowledge_snapshots set active = (id = p_snapshot_id), status = case when id = p_snapshot_id then 'active' else status end
  where source_id = (select source_id from knowledge_snapshots where id = p_snapshot_id);
  update knowledge_chunks set active = (snapshot_id = p_snapshot_id)
  where source_id = (select source_id from knowledge_snapshots where id = p_snapshot_id);
end;
$$;

create or replace function log_chat_outcome(p_question text, p_status text, p_confidence numeric default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into chat_logs(question, answer_status, confidence)
  values (p_question, p_status, p_confidence);
$$;

revoke all on function match_knowledge_chunks(vector, real, integer) from public, anon, authenticated;
grant execute on function match_knowledge_chunks(vector, real, integer) to service_role;
revoke all on function insert_source_snapshot(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function insert_source_snapshot(uuid, text, text, text, text, text) to service_role;
revoke all on function insert_knowledge_chunks(jsonb) from public, anon, authenticated;
grant execute on function insert_knowledge_chunks(jsonb) to service_role;
revoke all on function activate_snapshot(uuid) from public, anon, authenticated;
grant execute on function activate_snapshot(uuid) to service_role;
revoke all on function log_chat_outcome(text, text, numeric) from public, anon, authenticated;
grant execute on function log_chat_outcome(text, text, numeric) to service_role;

create or replace function get_active_source_hashes()
returns table(source_id text, content_hash text) language sql stable security definer set search_path = public, pg_temp as $$ select source_id, content_hash from knowledge_snapshots where active = true and status = 'active'; $$;

create or replace function refresh_knowledge_base(p_sources jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare x jsonb; snapshot_id uuid;
begin
 if jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) = 0 then raise exception 'Refresh payload must be non-empty'; end if;
 for x in select * from jsonb_array_elements(p_sources) loop
  insert into knowledge_snapshots(source_id, raw_content, normalized_markdown, content_hash, status) values (x->>'source_id', x->>'raw_content', x->>'normalized_markdown', x->>'content_hash', 'pending') returning id into snapshot_id;
  insert into knowledge_chunks(source_id, snapshot_id, text_content, embedding, section, content_hash) select x->>'source_id', snapshot_id, c->>'content', (c->'embedding')::text::vector, nullif(c->>'section','null'), nullif(c->>'content_hash','null') from jsonb_array_elements(x->'chunks') c;
 end loop;
 update knowledge_snapshots set active = false where active = true;
 update knowledge_chunks set active = false where active = true;
 update knowledge_snapshots set active = true, status = 'active' where status = 'pending' and created_at >= now() - interval '1 minute';
 update knowledge_chunks set active = true where snapshot_id in (select id from knowledge_snapshots where status = 'active' and created_at >= now() - interval '1 minute');
end; $$;
