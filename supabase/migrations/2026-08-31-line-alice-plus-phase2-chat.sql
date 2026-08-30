-- Alice Plus (LINE) Phase 2: トーク会話履歴。
-- Apply before enabling LINE_ALICE_CHAT_ENABLED.
--
-- 役割:
--   - Alice の会話コンテキスト (直近履歴) の供給源
--   - 無料枠カウント (JST日次・role='user' の行数)
--   - トークン数記録によるコスト把握
-- アクセスは service role のみ (RLS 有効・policy なし)。

begin;

create table if not exists public.line_chat_messages (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  user_id uuid null references public.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_line_chat_messages_line_user_created
  on public.line_chat_messages(line_user_id, created_at desc);

alter table public.line_chat_messages enable row level security;
-- policy は作らない: service role 専用テーブル。

commit;
