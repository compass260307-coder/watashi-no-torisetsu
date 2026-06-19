-- 友達評価に「本人へのメッセージ」自由記載欄を追加する。
--
-- 背景: /friend/[inviteCode] の最後で、評価者が本人へひとことメッセージ (任意・最大200字)
--       を書けるようにした。本人側 (/me/[token]) に「友達からのメッセージ」として記名表示する。
--
-- 安全性:
--   - 既存行への影響なし (nullable、デフォルト null)。
--   - RLS 変更なし。書き込み/読み取りはアプリの service role (supabaseAdmin) 経由のため
--     RLS をバイパスする。新カラム追加でポリシーは変わらない。
--   - アプリ側コードはこのカラムが無くても壊れない設計 (書き込みは best-effort update、
--     読み取りは try/catch フォールバック) なので、本 migration 適用前後どちらでも動作する。
--     適用後にメッセージの保存・表示が有効化される。

alter table friend_perceptions
  add column if not exists owner_message text;
