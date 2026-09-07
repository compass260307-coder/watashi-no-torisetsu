-- Alice Plus (LINE) Phase 3: Stripe 月額サブスク (¥480/月)。
--
-- Stripe のサブスクリプション状態をそのまま写すテーブル。真実は常に Stripe 側にあり、
-- webhook (checkout.session.completed / customer.subscription.*) が同期する。
-- Plus 判定は status in ('active','trialing') の行があるかどうかだけを見る。
--
-- 適用方法: Supabase ダッシュボード SQL Editor で手動実行 (phase1/2 と同じ)。

begin;

create table if not exists public.line_plus_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  line_user_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text not null,
  -- Stripe subscription status: active / trialing / past_due / canceled /
  -- incomplete / incomplete_expired / unpaid / paused
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_line_plus_subscriptions_stripe_sub
  on public.line_plus_subscriptions(stripe_subscription_id);

create index if not exists idx_line_plus_subscriptions_user_id
  on public.line_plus_subscriptions(user_id);

create index if not exists idx_line_plus_subscriptions_line_user_id
  on public.line_plus_subscriptions(line_user_id);

alter table public.line_plus_subscriptions enable row level security;
-- policy は作らない: service role 専用テーブル (line_accounts / line_link_codes と同方針)。

commit;
