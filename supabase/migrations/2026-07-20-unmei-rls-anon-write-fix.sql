-- unmei 系テーブルの anon 書き込み穴を塞ぐ (2026-07-20 / RLS 監査で発見)
--
-- 問題: 2026-07-18-unmei-schema.sql の "service_*" ポリシーは `to` 句が無いため
--   全ロール (anon 含む) に適用される。
--     - for insert with check (true)  → anon key で任意の行を insert できる
--     - for update with check (true)  → USING が省略時は WITH CHECK が流用されるため、
--                                        anon key で全行を update (改竄) できる
--   命名から service_role 用のつもりだったと思われるが、service_role は RLS を
--   バイパスするのでポリシー自体が不要 (勘違いによる全開放)。
--
-- 実書き込みはすべて supabaseAdmin (service_role) 経由
--   (src/lib/unmei/generateWorker.mjs / api/birth-profile / api/unmei/*) のため、
--   drop によるアプリへの影響は無い。auth.uid() ベースの select ポリシーは
--   Supabase Auth 導入時のために残す (auth 未使用の現在は常に不成立 = 遮断)。
--
-- 適用: Supabase SQL Editor で本ファイルを実行する (自動適用はされない)。

drop policy if exists "service_insert_or_update_natal_charts" on public.natal_charts;
drop policy if exists "service_update_natal_charts" on public.natal_charts;

drop policy if exists "service_insert_or_update_natal_readings" on public.natal_readings;
drop policy if exists "service_update_natal_readings" on public.natal_readings;

drop policy if exists "service_insert_or_update_transit_readings" on public.transit_readings;
drop policy if exists "service_update_transit_readings" on public.transit_readings;
