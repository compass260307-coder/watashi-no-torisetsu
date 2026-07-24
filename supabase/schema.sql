-- ワタシのトリセツ MVP schema

create table users (
  id uuid default gen_random_uuid() primary key,
  type_id text not null,
  scores jsonb not null,
  invite_code text unique not null,
  owner_token text unique,
  display_name text,
  campaign text,
  source_user_id uuid references users(id),
  generation smallint,
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

-- LIFF/LINE 友だち追加時の owner_token 紐付け
create table if not exists line_users (
  id uuid default gen_random_uuid() primary key,
  owner_token text not null,
  line_user_id text not null unique,
  welcome_sent_at timestamptz null,
  created_at timestamptz default now(),
  constraint fk_owner_token
    foreign key (owner_token)
    references users(owner_token)
    on delete cascade
);

-- 既存テーブルへのカラム追加 (Phase G-2 migration)
alter table line_users
  add column if not exists welcome_sent_at timestamptz null;

create index if not exists idx_line_users_owner_token on line_users(owner_token);
create index if not exists idx_line_users_line_user_id on line_users(line_user_id);
create index if not exists idx_line_users_welcome_sent_at on line_users(welcome_sent_at);

alter table line_users enable row level security;
create policy "anyone can insert line_users" on line_users for insert with check (true);
create policy "anyone can read line_users" on line_users for select using (true);
create policy "anyone can update line_users" on line_users for update using (true);

-- リッチメニュー「準備中」セルでお知らせを希望したユーザーの登録
create table if not exists feature_optins (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  feature text not null,
  created_at timestamptz default now(),
  unique(line_user_id, feature)
);

create index if not exists idx_feature_optins_line_user_id on feature_optins(line_user_id);
create index if not exists idx_feature_optins_feature on feature_optins(feature);

alter table feature_optins enable row level security;
create policy "anyone can insert feature_optins" on feature_optins for insert with check (true);
create policy "anyone can read feature_optins" on feature_optins for select using (true);

-- =========================================================
-- PR-FIX-1: RLS lockdown migration (実行手順)
--   Supabase Dashboard → SQL Editor で以下を実行する。
--   全 anon ポリシーを drop。service_role はデフォルトで全 CRUD 可能なので
--   新規ポリシーは不要 (= anon からの直接アクセスを完全に封鎖)。
-- =========================================================

-- users
drop policy if exists "anyone can insert users" on users;
drop policy if exists "anyone can read users" on users;
drop policy if exists "anyone can update users" on users;

-- friend_answers
drop policy if exists "anyone can insert friend_answers" on friend_answers;
drop policy if exists "anyone can read friend_answers" on friend_answers;

-- events
drop policy if exists "anyone can insert events" on events;
drop policy if exists "anyone can read events" on events;

-- line_users
drop policy if exists "anyone can insert line_users" on line_users;
drop policy if exists "anyone can read line_users" on line_users;
drop policy if exists "anyone can update line_users" on line_users;

-- feature_optins
drop policy if exists "anyone can insert feature_optins" on feature_optins;
drop policy if exists "anyone can read feature_optins" on feature_optins;

-- =========================================================
-- PR-FIX-3 H8: friend_count race condition 対策
--   3 人の friend がほぼ同時に submit したときに通知 N3 が
--   2 重送信されないよう、最後に通知済みの友達数を保持する。
--   Dashboard SQL Editor で以下を実行する。
-- =========================================================
alter table users
  add column if not exists last_notified_friend_count int default 0;

-- 出生データプロファイル (users と 1:1)
create table if not exists birth_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  prefecture text,
  city text,
  latitude double precision,
  longitude double precision,
  place_unknown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_birth_profiles_user_id on birth_profiles(user_id);

alter table birth_profiles enable row level security;
-- RLS: 本人のみのアクセスを許可 (auth.uid() = user_id)。
create policy "user_select_own_birth_profile" on birth_profiles for select using (auth.uid() = user_id);
create policy "user_insert_own_birth_profile" on birth_profiles for insert with check (auth.uid() = user_id);
create policy "user_update_own_birth_profile" on birth_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_delete_own_birth_profile" on birth_profiles for delete using (auth.uid() = user_id);

-- natal_charts: 計算済み出生図のキャッシュ
create table if not exists natal_charts (
  user_id uuid primary key references users(id) on delete cascade,
  chart jsonb,
  computed_at timestamptz,
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table natal_charts enable row level security;
create policy "user_select_own_natal_charts" on natal_charts for select using (auth.uid() = user_id);
-- Note: service role should perform compute/insert/update; client access is restricted to the user via select policy above.

-- users フラグ: natal chart ready
alter table users
  add column if not exists natal_chart_ready boolean not null default false;
-- users フラグ: unmei (運命の設計図) 購入フラグ
alter table users
  add column if not exists unmei boolean not null default false;

-- natal_readings: AI 生成済み鑑定キャッシュ
create table if not exists natal_readings (
  user_id uuid primary key references users(id) on delete cascade,
  reading jsonb not null,
  model text not null,
  generated_at timestamptz not null default now()
);
alter table natal_readings enable row level security;
create policy "user_select_own_natal_readings" on natal_readings for select using (auth.uid() = user_id);

-- transit_readings: 月次経過チャートキャッシュ
create table if not exists transit_readings (
  user_id uuid not null references users(id) on delete cascade,
  month text not null,
  reading jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table transit_readings enable row level security;
create policy "user_select_own_transit_readings" on transit_readings for select using (auth.uid() = user_id);

