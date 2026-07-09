-- PR1: entitlement 基盤 (¥299 買い切り・全解放)
--   users.plan は既存 (phase-3b-release-3-plan-column, default 'free')。
--   ここでは 'full' を許容し、分析用の購入日時 full_access_at を足す。
--   実行: Supabase Dashboard → SQL Editor で全文実行 (idempotent)。

-- 1. 購入日時 (初回 full 化のタイムスタンプ。webhook 冪等更新で初回のみ埋める)
alter table public.users
  add column if not exists full_access_at timestamptz;

-- 2. plan に 'full' を許可。既存 CHECK があれば貼り替え、無ければ新規付与 (idempotent)。
alter table public.users drop constraint if exists users_plan_check;
do $$
begin
  alter table public.users
    add constraint users_plan_check check (plan in ('free', 'full'));
exception when duplicate_object then null;
end $$;

-- 動作確認 (任意):
--   select plan, count(*) from public.users group by plan;
--   select column_name from information_schema.columns
--     where table_name='users' and column_name='full_access_at';
