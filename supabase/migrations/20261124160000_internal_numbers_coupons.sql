-- 社内向け数値画面 (/internal/numbers) の第7段: 広告のクーポン (月ごと・手入力)。
--
-- X の広告費は請求のときにクーポンが差し引かれることがあり、利益ダッシュボードでは
-- 「クレジット」として広告費から引いていた。X Ads API ではクーポンの額が取れない
-- (2026-11-24 確認: 広告アカウントの支払い方法はクレジットカードだけ)。そこで、
-- その月に使ったクーポンの額を、月の推移の画面から手で入れる。
--
-- 日ごとの広告費・利益は変えない (クーポンが何日の分かは決められないため)。
-- 月の合計にだけ「クーポン」と「利益 (クーポン控除後)」を出す。

begin;

create table if not exists public.ad_coupons_monthly (
  -- その月の 1 日。
  month date not null check (extract(day from month) = 1),
  medium text not null default 'x' check (medium in ('x', 'tiktok', 'meta', 'other')),
  locale text not null default 'ja' check (locale in ('ja', 'ko', 'en', 'id')),
  amount_jpy numeric(12, 2) not null check (amount_jpy >= 0),
  updated_at timestamptz not null default now(),
  primary key (month, medium, locale)
);

alter table public.ad_coupons_monthly enable row level security;
revoke all on table public.ad_coupons_monthly from public, anon, authenticated;
grant select, insert, update, delete on table public.ad_coupons_monthly to service_role;

commit;
