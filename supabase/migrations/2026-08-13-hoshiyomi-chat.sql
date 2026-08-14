-- プレミアム限定「星読みの案内人」チャット。
-- 会話本文は UIMessage(JSONB) のまま保存し、月間利用数は別テーブルで原子的に予約する。

create table if not exists public.hoshiyomi_conversations (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default '新しい会話' check (char_length(title) between 1 and 80),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hoshiyomi_conversations_user_updated
  on public.hoshiyomi_conversations (user_id, updated_at desc);

create table if not exists public.hoshiyomi_monthly_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_month text not null check (usage_month ~ '^\d{4}-\d{2}$'),
  message_count integer not null default 0 check (message_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_month)
);

alter table public.hoshiyomi_conversations enable row level security;
alter table public.hoshiyomi_monthly_usage enable row level security;

-- ブラウザからDBへ直接は触らせず、Cookie認証済みRoute Handler + service roleだけを入口にする。
revoke all on public.hoshiyomi_conversations from anon, authenticated;
revoke all on public.hoshiyomi_monthly_usage from anon, authenticated;

create or replace function public.reserve_hoshiyomi_message(
  p_user_id uuid,
  p_limit integer default 30
)
returns table (allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(timezone('UTC', now()), 'YYYY-MM');
  v_used integer;
begin
  insert into public.hoshiyomi_monthly_usage (user_id, usage_month, message_count)
  values (p_user_id, v_month, 0)
  on conflict (user_id, usage_month) do nothing;

  update public.hoshiyomi_monthly_usage
     set message_count = message_count + 1,
         updated_at = now()
   where user_id = p_user_id
     and usage_month = v_month
     and message_count < greatest(p_limit, 0)
  returning message_count into v_used;

  if v_used is not null then
    return query select true, v_used, greatest(p_limit - v_used, 0);
    return;
  end if;

  select message_count into v_used
    from public.hoshiyomi_monthly_usage
   where user_id = p_user_id and usage_month = v_month;
  return query select false, coalesce(v_used, 0), 0;
end;
$$;

revoke all on function public.reserve_hoshiyomi_message(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_hoshiyomi_message(uuid, integer) to service_role;
