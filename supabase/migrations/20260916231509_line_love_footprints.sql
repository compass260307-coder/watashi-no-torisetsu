-- Alice Plus「恋の足あと」。恋の出来事を本人だけが読み返せるタイムライン。
-- Web/APIからのアクセスはservice roleに限定し、必ずLINE署名と現在の連携先を検証する。

begin;

create table if not exists public.line_love_footprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  happened_on date not null,
  partner_name text,
  kind text not null,
  mood text not null,
  title text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_love_footprints_partner_name_length check (
    partner_name is null or char_length(partner_name) between 1 and 40
  ),
  constraint line_love_footprints_kind_check check (
    kind in ('meeting', 'happy', 'worry', 'turning_point', 'goodbye', 'other')
  ),
  constraint line_love_footprints_mood_check check (
    mood in ('flutter', 'happy', 'calm', 'uncertain', 'sad', 'hopeful')
  ),
  constraint line_love_footprints_title_length check (
    char_length(title) between 1 and 80
  ),
  constraint line_love_footprints_note_length check (
    note is null or char_length(note) between 1 and 1200
  )
);

create index if not exists idx_line_love_footprints_user_date
  on public.line_love_footprints(user_id, happened_on desc, created_at desc);

drop trigger if exists trg_line_love_footprints_touch_updated_at
  on public.line_love_footprints;
create trigger trg_line_love_footprints_touch_updated_at
before update on public.line_love_footprints
for each row execute function public.touch_line_account_updated_at();

alter table public.line_love_footprints enable row level security;
-- policyは作らない: service role専用。

comment on table public.line_love_footprints is
  'Private Alice Plus timeline of romantic memories entered by the linked user.';

commit;
