-- Persistent chat sessions. A reset starts a new session; old sessions stay.
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on chat_messages (session_id, created_at);

-- Only the server (service_role) touches chat data.
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
revoke all on table chat_sessions from public, anon, authenticated;
revoke all on table chat_messages from public, anon, authenticated;
grant select, insert, update on table chat_sessions to service_role;
grant select, insert on table chat_messages to service_role;
