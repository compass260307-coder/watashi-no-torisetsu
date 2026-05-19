-- =================================================================
-- プレミアム化 v2 Week 1 T1-5: integrated_trisetsu スキーマ拡張
--   - 計画書 docs/PREMIUM_PLAN.md § 12 / § 13 に準拠
--   - Opus 4.7 + 7 章 + 課金紐付け + PDF + status 管理に対応する列を追加
--   - 既存列 generated_summary / generated_body は新規 INSERT で使わなくなるが、
--     Week 3 の完全リセット (TRUNCATE) 後に別マイグレーションで DROP COLUMN する想定
--     → 本マイグレーションでは互換維持のため残置 (NOT NULL 制約のみ解除)
--   - すべて add 系 + alter (drop not null) + create index、列削除なし
--   - IF NOT EXISTS / DO ブロックで再実行安全 (idempotent)
--   - RLS は integrated_trisetsu に既存設定 (PR-FIX-1 lockdown) を継承
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
--   - 本番適用タイミング: Week 3 の DB リセットと同タイミングで一括適用推奨
--     (それまではローカル/開発 DB のみ適用)
-- =================================================================

-- =============================================================
-- 1. 新規列の追加
-- =============================================================
alter table integrated_trisetsu
  -- 7 章構成の本文 JSON
  -- 形式: { essence:{title,subtitle,body}, multifacetedness:{...},
  --         hidden_self:{...}, strengths_weaknesses:{...},
  --         relationships:{...}, life_guidance:{...},
  --         message:{title,body} }  ※ message のみ subtitle 無し
  add column if not exists generated_chapters jsonb,

  -- ルート direct の副題 (旧 generated_summary を計画書 v2 の用語に合わせて分離)
  add column if not exists generated_subtitle text,

  -- 生成ステータス (計画書 O3 反映)
  --   pending     : payment 完了、生成キュー待ち
  --   generating  : AI 呼び出し中
  --   completed   : 生成完了
  --   failed      : 生成失敗 (手動対応待ち)
  add column if not exists status text not null default 'pending',

  -- 失敗時のエラー要約 (events ログと併用)
  add column if not exists failure_reason text,

  -- JSON パース・スキーマ違反でのリトライ回数 (anthropic-client.ts 内のリトライ回数を反映)
  add column if not exists retry_count integer not null default 0,

  -- 課金紐付け + Idempotency 用 (計画書 O4 反映)
  -- 外部キー制約は payment_history テーブル作成後 (T2-9) に別途付与する。
  -- 今は uuid 型のみで列を確保。
  add column if not exists payment_id uuid,

  -- PDF 生成時刻 (T2-2 で更新)
  add column if not exists pdf_generated_at timestamptz,

  -- PDF の保存先 URL (Supabase Storage、T2-2 で書き込み)
  add column if not exists pdf_url text;


-- =============================================================
-- 2. 既存 NOT NULL 制約の解除
-- =============================================================
-- generated_body は v1 時代の必須カラムだったが、v2 では generated_chapters に置換。
-- 新規 INSERT で書き込まなくても済むよう NOT NULL を外す。
-- (既存行は引き続き値を保持。Week 3 リセット後に列ごと DROP 想定)
alter table integrated_trisetsu
  alter column generated_body drop not null;


-- =============================================================
-- 3. status の CHECK 制約 (列挙値の固定)
-- =============================================================
-- ADD CONSTRAINT は IF NOT EXISTS をサポートしないため DO ブロックで idempotent 化
do $$
begin
  alter table integrated_trisetsu
    add constraint integrated_trisetsu_status_check
    check (status in ('pending', 'generating', 'completed', 'failed'));
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 4. インデックス
-- =============================================================

-- payment_id への UNIQUE 部分インデックス (計画書 v2 § 13)
-- 1 つの決済 = 1 つの統合トリセツ生成を強制 (二重生成防止 = Idempotency 第 2 層)
create unique index if not exists idx_integrated_trisetsu_payment_unique
  on integrated_trisetsu(payment_id)
  where payment_id is not null;

-- 失敗/進行中レコードの監視用 (Slack アラート、整合性スクリプト用)
-- completed は除外することで運用クエリ高速化 + インデックス肥大化抑制
create index if not exists idx_integrated_trisetsu_status_pending
  on integrated_trisetsu(status)
  where status <> 'completed';


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. 列が追加されているか:
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_name = 'integrated_trisetsu'
--      and column_name in (
--        'generated_chapters', 'generated_subtitle', 'status',
--        'failure_reason', 'retry_count', 'payment_id',
--        'pdf_generated_at', 'pdf_url', 'generated_body'
--      )
--    order by column_name;
--
-- B. CHECK 制約が効いているか (失敗を期待):
--
--   insert into integrated_trisetsu (user_id, perception_ids, source_summary, status)
--   values (gen_random_uuid(), '{}', '{}'::jsonb, 'invalid_status');
--   -- 期待: ERROR: new row for relation "integrated_trisetsu" violates check constraint
--
-- C. payment_id UNIQUE 部分インデックスが効いているか:
--
--   -- 2 行とも payment_id NULL は OK
--   insert into integrated_trisetsu (user_id, perception_ids, source_summary) values (...) , (...);
--   -- 同じ payment_id を 2 件入れると失敗を期待
--
-- =============================================================
-- End of プレミアム化 v2 Week 1 T1-5 マイグレーション
-- =============================================================
