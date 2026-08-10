-- 運命の設計図キャッシュの RLS 修正。
--
-- 旧 "service_*" ポリシーは対象ロールを指定せず with check (true) としていたため、
-- anon / authenticated にテーブル権限がある場合にも INSERT / UPDATE を許可していた。
-- service_role は RLS を迂回するので、サーバ処理のための許可ポリシーは不要。

begin;

drop policy if exists "service_insert_or_update_natal_charts" on public.natal_charts;
drop policy if exists "service_update_natal_charts" on public.natal_charts;
drop policy if exists "service_insert_or_update_natal_readings" on public.natal_readings;
drop policy if exists "service_update_natal_readings" on public.natal_readings;
drop policy if exists "service_insert_or_update_transit_readings" on public.transit_readings;
drop policy if exists "service_update_transit_readings" on public.transit_readings;

-- Data API のテーブル権限も最小化し、RLS と二重に防御する。
revoke all on public.natal_charts from anon, authenticated;
revoke all on public.natal_readings from anon, authenticated;
revoke all on public.transit_readings from anon, authenticated;
grant select on public.natal_charts to authenticated;
grant select on public.natal_readings to authenticated;
grant select on public.transit_readings to authenticated;

-- 本人参照ポリシーはログイン済みロールだけに限定する。
drop policy if exists "user_select_own_natal_charts" on public.natal_charts;
create policy "user_select_own_natal_charts"
  on public.natal_charts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_select_own_natal_readings" on public.natal_readings;
create policy "user_select_own_natal_readings"
  on public.natal_readings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_select_own_transit_readings" on public.transit_readings;
create policy "user_select_own_transit_readings"
  on public.transit_readings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
