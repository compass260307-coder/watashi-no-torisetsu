-- =================================================================
-- ロールバック: プレミアム化 v2 Week 3 T3-3 (friend_perceptions pdf_consent)
--   - 対応マイグレーション: premium-v2-week3-friend-perceptions-pdf-consent.sql
-- =================================================================

-- 1. インデックス削除
drop index if exists idx_friend_perceptions_pdf_consent;

-- 2. 列削除
alter table friend_perceptions
  drop column if exists pdf_consent_revoked_at,
  drop column if exists pdf_consent_at,
  drop column if exists pdf_consent;
