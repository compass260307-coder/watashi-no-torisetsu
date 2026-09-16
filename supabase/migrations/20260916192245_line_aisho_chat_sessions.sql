-- Alice Plus「相性占い」の複数ターン入力をLINEトーク内でつなぐ一時セッション。
-- 出生情報は鑑定完了時に即時削除し、途中離脱分も30分で失効させる。
-- アクセスはLINE webhookのservice roleだけに限定する。

begin;

create table if not exists public.line_aisho_sessions (
  line_user_id text primary key
    references public.line_accounts(line_user_id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_aisho_sessions_step_check check (
    step in (
      'partner_name',
      'relationship',
      'partner_birth_date',
      'you_birth_date',
      'confirm'
    )
  ),
  constraint line_aisho_sessions_data_object_check check (
    jsonb_typeof(data) = 'object'
  )
);

create index if not exists idx_line_aisho_sessions_expires_at
  on public.line_aisho_sessions(expires_at);

drop trigger if exists trg_line_aisho_sessions_touch_updated_at
  on public.line_aisho_sessions;
create trigger trg_line_aisho_sessions_touch_updated_at
before update on public.line_aisho_sessions
for each row execute function public.touch_line_account_updated_at();

alter table public.line_aisho_sessions enable row level security;
-- policyは作らない: service role専用。

comment on table public.line_aisho_sessions is
  'Temporary LINE compatibility-reading state. Delete on completion; abandoned rows expire after 30 minutes.';

commit;
