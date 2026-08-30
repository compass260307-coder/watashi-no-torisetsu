-- Alice Plus (LINE) Phase 1: LINEアカウント連携の土台。
-- Apply before deploying /api/line/webhook と /api/line/link-code.
--
-- 旧 line_users / feature_optins (LIFF時代・RLS全開放) は使わない。
-- 1から作り直し方針のため新テーブルで管理する。旧テーブルの削除は別途判断。
-- アクセスは service role のみ (RLS 有効・policy なし)。

begin;

-- LINE友だち1人につき1行。user_id が null の間は「友だちだが未連携」。
create table if not exists public.line_accounts (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  user_id uuid null references public.users(id) on delete set null,
  followed_at timestamptz,
  unfollowed_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_line_accounts_user_id
  on public.line_accounts(user_id);

create or replace function public.touch_line_account_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_line_accounts_touch_updated_at on public.line_accounts;
create trigger trg_line_accounts_touch_updated_at
before update on public.line_accounts
for each row execute function public.touch_line_account_updated_at();

-- Web(/me)で発行した6桁連携コード。トークに送信されると consumed になる。
-- code は平文で保存せず HMAC (app_transfer_codes と同方式) で持つ。
create table if not exists public.line_link_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_line_user_id text,
  created_at timestamptz not null default now()
);

-- 有効なコードの重複だけ禁止する (消費済み/削除済みの過去コードとの衝突は許容)。
-- 発行APIは insert 前に期限切れ未消費行を削除して空間を空ける。
create unique index if not exists uq_line_link_codes_active_code
  on public.line_link_codes(code_hash)
  where consumed_at is null;

create index if not exists idx_line_link_codes_user_id
  on public.line_link_codes(user_id);

alter table public.line_accounts enable row level security;
alter table public.line_link_codes enable row level security;
-- policy は作らない: どちらも service role 専用テーブル。

commit;
