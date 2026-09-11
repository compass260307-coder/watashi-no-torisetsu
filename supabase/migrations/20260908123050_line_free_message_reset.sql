begin;

-- 会話履歴を削除せず、個別アカウントの無料3通を再開できるようにする。
-- null の既存ユーザーは従来どおり全期間の user 発言を数える。
alter table public.line_accounts
  add column if not exists free_messages_reset_at timestamptz;

comment on column public.line_accounts.free_messages_reset_at is
  'Only user messages after this timestamp count toward the lifetime free chat allowance.';

commit;
