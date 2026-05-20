-- =================================================================
-- プレミアム化 v2 Week 3 T3-3: friend_perceptions に pdf_consent 列追加
--   - 本来 T1-5 で追加予定だったが、当時の SQL ファイルが
--     integrated_trisetsu のみを対象としていたため抜けていた (発覚: 2026-05-20)
--   - 計画書 docs/PREMIUM_PLAN.md § 12 / § 33 / § 34 (B3) に準拠
--   - 既存 friend_perceptions 行は pdf_consent=false (DEFAULT) で
--     自動的に「Web 閲覧のみ可、PDF 利用不可」になる (B3 オプトイン制)
--   - すべて add 系、列削除なし
--   - IF NOT EXISTS で再実行安全 (idempotent)
--   - RLS は既存設定 (PR-FIX-1 lockdown) を継承
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
-- =================================================================

-- =============================================================
-- 1. 新規列の追加
-- =============================================================
alter table friend_perceptions
  -- T3-3 (B3): PDF 利用同意フラグ。
  -- - true: AI 統合トリセツ PDF に名前付きで載せることに同意済
  -- - false (デフォルト): Web 閲覧のみ可、PDF 化と AI 統合素材化は不可
  add column if not exists pdf_consent boolean not null default false,

  -- 同意した日時 (true 設定時に NOW()、false なら null)
  add column if not exists pdf_consent_at timestamptz,

  -- Phase 2: 同意取消フロー実装時に使う
  add column if not exists pdf_consent_revoked_at timestamptz;


-- =============================================================
-- 2. インデックス
-- =============================================================
-- AI 統合素材選択クエリ高速化 (オーナー視点で「PDF 利用可な perception 一覧」を取る)
-- 部分インデックスで肥大化抑制
create index if not exists idx_friend_perceptions_pdf_consent
  on friend_perceptions(target_user_id, pdf_consent)
  where pdf_consent = true;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. 列追加確認:
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_name = 'friend_perceptions'
--      and column_name like 'pdf_consent%'
--    order by column_name;
--
-- B. 既存行に DEFAULT false が反映されているか:
--
--   select pdf_consent, count(*)
--     from friend_perceptions
--    group by pdf_consent;
--   -- 期待: true=0, false=既存全件
--
-- =============================================================
-- End of プレミアム化 v2 Week 3 T3-3 マイグレーション
-- =============================================================
