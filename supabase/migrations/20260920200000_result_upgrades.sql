-- 完全版購入後の追加質問をもとに、専用キャラクター・型名・冒頭文・鑑定書を生成する。
-- 生成物は本人の既存 users 行に1:1で紐づけ、サービスロール経由だけで更新する。

create table if not exists public.result_upgrades (
  user_id uuid primary key references public.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  source_type_id text not null,
  source_character_path text not null,
  state text not null default 'answers_ready'
    check (state in ('answers_ready', 'generating', 'ready', 'failed')),
  personalized_type_name text,
  personalized_intro text,
  reading jsonb,
  character_storage_path text,
  text_model text,
  image_model text,
  attempts integer not null default 0 check (attempts >= 0),
  generation_started_at timestamptz,
  generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_upgrades_answers_array check (jsonb_typeof(answers) = 'array')
);

alter table public.result_upgrades enable row level security;

comment on table public.result_upgrades is
  'Aliceの追加質問から生成する、ユーザー専用の診断結果と鑑定書。APIはservice roleでのみ操作する。';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'result-upgrade-characters',
  'result-upgrade-characters',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
