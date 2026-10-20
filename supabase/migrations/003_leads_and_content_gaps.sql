-- Quote requests captured from the chat UI.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  message text check (message is null or char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists leads_created_idx on leads (created_at desc);

alter table leads enable row level security;
revoke all on table leads from public, anon, authenticated;
grant select, insert on table leads to service_role;

-- Questions the bot could not answer from approved content:
-- answer_status = 'unanswered' (nothing found) or 'partial' (only part answered).
create index if not exists chat_logs_status_created_idx
  on chat_logs (answer_status, created_at desc);

create or replace view content_gaps as
  select lower(trim(question)) as question,
         count(*) as times_asked,
         count(*) filter (where answer_status = 'partial') as times_partial,
         max(created_at) as last_asked
  from chat_logs
  where answer_status in ('unanswered', 'partial')
  group by lower(trim(question))
  order by times_asked desc, last_asked desc;

revoke all on content_gaps from public, anon, authenticated;
grant select on content_gaps to service_role;
