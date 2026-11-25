-- 診断の最後に任意で聞く「性別」「年代」の保存先。
--
-- 性別はこれまで画面で選べたが、保存先が無くサーバーで捨てていた。年代は 2026-11-25 に
-- 画面へ足した。どちらも任意で、年代別・性別の課金率などを見るために使う。
--
-- users に列を足さず別の表にする理由:
--   - 結果ページなどで読む users の行に、属性を混ぜない (読む必要のある処理は集計だけ)。
--   - 保存は診断の保存のあとに別で行い、失敗しても診断は止めない (アプリを先に出しても壊れない)。
--
-- 値はアプリ側 (src/lib/diagnosis-profile.ts) で決めた選択肢だけを通す。区分を見直しても
-- この表を変えずに済むよう、DB では長さだけを見る。
--   gender:    male / female / other
--   age_group: 10s / 20s_early / 20s_late / 30s / 40s / 50s_plus

begin;

create table if not exists public.user_demographics (
  user_id uuid primary key references public.users(id) on delete cascade,
  gender text check (gender is null or char_length(gender) between 1 and 32),
  age_group text check (age_group is null or char_length(age_group) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- サーバー (service_role) だけが読み書きする。ブラウザからは一切届かない。
alter table public.user_demographics enable row level security;
revoke all on table public.user_demographics from public, anon, authenticated;
grant select, insert, update, delete on table public.user_demographics to service_role;

commit;
