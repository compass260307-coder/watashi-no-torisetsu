-- =================================================================
-- Phase 1.5-α Day 12-C2: payment_history に perception_unlock サポートを追加
--
-- 背景:
-- 既存「真のトリセツ 1 回 ¥500」(integrated_trisetsu 経路) はそのまま残し、
-- 新規「評価 1 件ごと ¥500」(perception_unlock 経路) を共存させる。
-- 2 種類は metadata でなく専用カラム (perception_id / payment_kind) で識別し、
-- SQL レベルで unlock 判定 + 二重課金防止を実現する。
--
-- スコープ:
-- - payment_history に perception_id + payment_kind を追加 (nullable、既存行は影響なし)
-- - 部分 UNIQUE index で同一 perception への二重 completed を DB レベル防止
-- - perception_id + status の検索高速化 index
--
-- 本番安全性:
-- - Day 12-B 調査により payment_history = 0 件 (2026-05-30 クリーンスタート済)
-- - 既存「真のトリセツ」フローも未使用、レコード追加なし → 全 ALTER が安全
-- - すべて IF NOT EXISTS / DO ブロックで idempotent
--
-- 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
-- =================================================================


-- =============================================================
-- 1. payment_history にカラム追加 (perception_id / payment_kind)
-- =============================================================
-- - perception_id: friend_perceptions.id への FK、unlock 系課金時のみ NOT NULL
--   ON DELETE SET NULL: perception が削除された場合も課金履歴は残す (refund 等の参照のため)
-- - payment_kind: 'integrated_trisetsu' (真のトリセツ) or 'perception_unlock' (評価ごと)
--   既存レコードは NULL のまま (未来のレコードは API 層で必ず set する想定)
alter table payment_history
  add column if not exists perception_id uuid null
    references friend_perceptions(id) on delete set null,
  add column if not exists payment_kind text null;


-- =============================================================
-- 2. payment_kind の CHECK 制約 (idempotent)
-- =============================================================
do $$
begin
  alter table payment_history
    add constraint payment_history_payment_kind_check
    check (payment_kind in ('integrated_trisetsu', 'perception_unlock'));
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 3. 同一 perception への二重 completed 課金を DB レベル防止
-- =============================================================
-- 部分 UNIQUE: perception_id IS NOT NULL かつ status='completed' の組のみ対象。
-- - 同じ perception に対する 2 回目の completed が物理的に作れない
-- - failed / pending / refunded は対象外 (リトライ可能を保つ)
-- - perception_id IS NULL (旧 integrated_trisetsu 経路) は対象外、衝突しない
create unique index if not exists idx_payment_unlocked_perception
  on payment_history(perception_id)
  where perception_id is not null and status = 'completed';


-- =============================================================
-- 4. perception_id + status の検索高速化 (アプリ層の判定用)
-- =============================================================
-- lib/perception-unlock.ts の isPerceptionUnlocked() が
--   WHERE perception_id = ? AND status = 'completed' AND payment_kind = 'perception_unlock'
-- を発行するため、その複合インデックス。
create index if not exists idx_payment_perception_status
  on payment_history(perception_id, status)
  where perception_id is not null;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. 追加カラムの存在確認:
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'payment_history'
--      and column_name in ('perception_id', 'payment_kind')
--    order by column_name;
--   -- 期待: 2 行 (どちらも nullable)
--
-- B. FK / CHECK 制約の確認:
--
--   select conname, contype
--     from pg_constraint
--    where conrelid = 'payment_history'::regclass
--      and conname in ('payment_history_perception_id_fkey',
--                      'payment_history_payment_kind_check');
--   -- 期待: 2 行
--
-- C. 部分 UNIQUE index の動作確認 (失敗を期待):
--
--   -- 適当な perception_id を用意して 2 件 completed INSERT を試みる
--   -- 2 件目で ERROR: duplicate key value violates unique constraint
--
-- =============================================================
-- End of Phase 1.5-α Day 12-C2 マイグレーション
-- =============================================================
