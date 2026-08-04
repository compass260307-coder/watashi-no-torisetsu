-- 重複ユーザーマージ (tombstone) の前提列。
--
-- 目的:
--   同一メールで生成された重複 users 行を「勝者1行」へ統合する際、敗者行を削除せず
--   merged_into=勝者id を立てて残す (tombstone)。これにより:
--     - 敗者側 session_token で今ログイン中の人がログアウトされない
--     - 敗者の owner_token を指す友達招待URL (/me/[owner_token]) も生き続ける
--   getSession は merged_into を辿って勝者を返す。
--
-- 既存ユーザーへの影響: なし。merged_into は既定 NULL で、NULL の行は従来通り自分自身を返す。
-- ON DELETE SET NULL: 万一勝者行が削除されても敗者は自分自身に解決する (安全側フォールバック)。

alter table users
  add column if not exists merged_into uuid null references users(id) on delete set null;

create index if not exists idx_users_merged_into on users(merged_into);
