-- 社内向け数値画面 (/internal/numbers): サーバー費の実額 (日ごと)。
--
-- 利益の「サーバー費」は、診断 1 件あたりの単価 × 診断数の概算で出している。実額と
-- 見比べられるよう、ホスティング (Vercel) の料金を 1 日 1 回取り込み、日 × プロジェクトで
-- 保存する (取り込みは /api/cron/server-costs、src/lib/server-costs.ts)。
--
--   * 金額は米ドル。料金の入口が返す EffectiveCost (割引後・クレジット適用前) と
--     BilledCost (請求額) の両方を持つ。
--   * day は、料金の入口が返す課金期間の開始日 (UTC)。日本時間の 1 日とは区切りがずれる。
--   * project は、料金に付いているプロジェクト名。プロジェクトに割り振られない分
--     (プランの定額など) は '(unattributed)'。
--
-- すべて service_role 専用。

begin;

create table if not exists public.server_cost_daily (
  day date not null,
  provider text not null check (provider ~ '^[a-z0-9_]{1,24}$'),
  project text not null check (char_length(project) between 1 and 120),
  -- クレジットや調整の行は負の金額になるので、0 以上に限らない。
  effective_usd numeric(14, 6) not null,
  billed_usd numeric(14, 6) not null,
  -- 足し合わせた料金の行数 (取り込みが途中で切れていないかの目安)。
  charges integer not null default 0 check (charges >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, provider, project)
);

alter table public.server_cost_daily enable row level security;

revoke all on table public.server_cost_daily from public, anon, authenticated;

grant select, insert, update, delete on table public.server_cost_daily to service_role;

-- 取り込んだ期間 (p_from 〜 p_to、両端を含む) の、その提供元の行を入れ替える。
-- 料金はあとから少し動くので、毎回直近の数日を取り直して上書きする。期間の外の行が
-- 混ざっていても保存しない。戻り値は保存した行数。
create or replace function public.server_cost_replace(
  p_provider text,
  p_from date,
  p_to date,
  p_rows jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  v_count integer;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  delete from server_cost_daily as c
   where c.provider = p_provider
     and c.day between p_from and p_to;

  insert into server_cost_daily (
    day, provider, project, effective_usd, billed_usd, charges
  )
  select
    (r.value ->> 'day')::date,
    p_provider,
    r.value ->> 'project',
    (r.value ->> 'effective')::numeric(14, 6),
    (r.value ->> 'billed')::numeric(14, 6),
    coalesce((r.value ->> 'charges')::integer, 0)
  from jsonb_array_elements(p_rows) as r
  where (r.value ->> 'day')::date between p_from and p_to;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.server_cost_replace(text, date, date, jsonb)
  from public, anon, authenticated;

grant execute on function public.server_cost_replace(text, date, date, jsonb)
  to service_role;

commit;
