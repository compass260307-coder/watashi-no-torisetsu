-- Alice Plus (LINE) Phase 4: 今日の占い (リッチメニュー) のデイリーキャッシュ。
--
-- 同じ日 (JST) に何度タップしても同じ結果を返すための保存先。
-- 生成は1日1回だけ走るので、コストと「占いが変わる」違和感の両方を防ぐ。
--
-- 適用方法: Supabase ダッシュボード SQL Editor で手動実行 (phase1〜3 と同じ)。

begin;

create table if not exists public.line_daily_fortunes (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  user_id uuid references public.users(id) on delete cascade,
  fortune_date date not null,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_line_daily_fortunes_user_date
  on public.line_daily_fortunes(line_user_id, fortune_date);

alter table public.line_daily_fortunes enable row level security;
-- policy は作らない: service role 専用テーブル。

commit;
