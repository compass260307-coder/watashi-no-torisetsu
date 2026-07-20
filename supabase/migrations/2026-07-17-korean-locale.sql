-- 日韓で診断結果を共有しつつ、流入言語・現在言語・イベント言語を分離して集計する。
-- 診断スコア / type_id / owner_token / 課金権限は言語共通の users 1行を使う。

alter table public.users
  add column if not exists acquisition_locale text not null default 'ja';

alter table public.users
  add column if not exists preferred_locale text not null default 'ja';

alter table public.events
  add column if not exists locale text not null default 'ja';

alter table public.users
  drop constraint if exists users_acquisition_locale_check;

alter table public.users
  add constraint users_acquisition_locale_check
  check (acquisition_locale in ('ja', 'ko'));

alter table public.users
  drop constraint if exists users_preferred_locale_check;

alter table public.users
  add constraint users_preferred_locale_check
  check (preferred_locale in ('ja', 'ko'));

alter table public.events
  drop constraint if exists events_locale_check;

alter table public.events
  add constraint events_locale_check check (locale in ('ja', 'ko'));

create index if not exists idx_users_acquisition_locale
  on public.users(acquisition_locale);

create index if not exists idx_users_preferred_locale
  on public.users(preferred_locale);

create index if not exists idx_events_locale_created_at
  on public.events(locale, created_at);

-- 既存ユーザー/イベントは default により ja でバックフィルされる。
-- 新規ユーザーは診断言語を acquisition_locale と preferred_locale に保存し、
-- 結果ページの言語切替では preferred_locale だけを更新する。
