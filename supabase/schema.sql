-- ワタシのトリセツ MVP schema

create table users (
  id uuid default gen_random_uuid() primary key,
  type_id text not null,
  scores jsonb not null,
  invite_code text unique not null,
  owner_token text unique,
  display_name text,
  created_at timestamptz default now()
);

create table friend_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  answers jsonb not null,
  created_at timestamptz default now()
);

-- 検索を高速化
create index idx_users_invite_code on users(invite_code);
create index idx_users_owner_token on users(owner_token);
create index idx_friend_answers_user_id on friend_answers(user_id);

-- RLS を有効化
alter table users enable row level security;
alter table friend_answers enable row level security;

-- anon ユーザーの読み書きを許可（MVP 用、後で絞る）
create policy "anyone can insert users" on users for insert with check (true);
create policy "anyone can read users" on users for select using (true);
create policy "anyone can update users" on users for update using (true);

create policy "anyone can insert friend_answers" on friend_answers for insert with check (true);
create policy "anyone can read friend_answers" on friend_answers for select using (true);

-- KPI計測用
create table events (
  id uuid default gen_random_uuid() primary key,
  event_name text not null,
  session_id text,
  invite_code text,
  owner_token text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_events_event_name on events(event_name);
create index idx_events_created_at on events(created_at);

alter table events enable row level security;
create policy "anyone can insert events" on events for insert with check (true);
create policy "anyone can read events" on events for select using (true);
