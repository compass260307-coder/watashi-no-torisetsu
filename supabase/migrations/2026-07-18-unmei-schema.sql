-- PR: 運命の設計図 / natal schema
--   birth_profiles / natal_charts / natal_readings / transit_readings
--   + users.unmei / users.unmei_at
--   実行: Supabase Dashboard → SQL Editor で全文実行 (idempotent)。

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
create policy "service_insert_or_update_natal_charts" on natal_charts for insert with check (true);
create policy "service_update_natal_charts" on natal_charts for update with check (true);

-- users フラグ: natal chart ready
alter table users
  add column if not exists natal_chart_ready boolean not null default false;
-- users フラグ: unmei (運命の設計図) 購入フラグ
alter table users
  add column if not exists unmei boolean not null default false;
-- users フラグ: unmei 購入日時
alter table users
  add column if not exists unmei_at timestamptz;

-- natal_readings: AI 生成済み鑑定キャッシュ
create table if not exists natal_readings (
  user_id uuid primary key references users(id) on delete cascade,
  reading jsonb not null,
  model text not null,
  generated_at timestamptz not null default now()
);

alter table natal_readings enable row level security;
create policy "user_select_own_natal_readings" on natal_readings for select using (auth.uid() = user_id);
create policy "service_insert_or_update_natal_readings" on natal_readings for insert with check (true);
create policy "service_update_natal_readings" on natal_readings for update with check (true);

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
create policy "service_insert_or_update_transit_readings" on transit_readings for insert with check (true);
create policy "service_update_transit_readings" on transit_readings for update with check (true);
