-- =================================================================
-- 致命バグ Hotfix (2026-05-18): users.line_user_id バックフィル
--
-- 問題:
--   /api/diagnosis が Authorization: Bearer なしで呼ばれた場合
--   (= 通常 Web 経由の自己診断)、users.line_user_id = NULL のまま
--   行が作られる。その後ユーザーが /line-register で LINE 連携しても、
--   line_users 行が作られるだけで users.line_user_id は更新されなかった。
--
-- 結果:
--   - /api/zukan-mine が users WHERE line_user_id = ? で自分の users を引く
--   - users 0 件 → target_user_id IN [] → friend_perceptions が永遠に空表示
--
-- 修正:
--   コード側: /api/line-register に backfill ロジック追加 (2026-05-18 push)
--           + /api/zukan-mine に line_users 経由のフォールバック追加
--
-- 本 SQL:
--   既存の影響ユーザー (line_users が指す owner_token に users.line_user_id=NULL
--   が紐付いている行) を、まとめてバックフィルする。
--   A-1 マイグレーション (phase-3b-release-1-foundations.sql) と同じパターン、
--   実行後に追加で新規発生したものを拾う。
--
-- 安全性:
--   - 追加のみ (UPDATE)、削除一切なし
--   - WHERE users.line_user_id IS NULL で対象限定 (二重実行しても無害)
--   - 既存の line_user_id 値は上書きしない
-- =================================================================

-- 1. 影響行数を事前確認 (実行は任意)
--    select count(*) as before_backfill
--      from users u
--      join line_users lu on lu.owner_token = u.owner_token
--     where u.line_user_id is null;

-- 2. バックフィル本体 (A-1 と同じパターン)
update users
   set line_user_id = lu.line_user_id
  from line_users lu
 where users.owner_token = lu.owner_token
   and users.line_user_id is null;

-- 3. line_users.current_owner_token 経由でも紐付く users もカバー
--    (再診断で current が users.owner_token = 旧 owner_token を指さなくなった行)
update users
   set line_user_id = lu.line_user_id
  from line_users lu
 where users.owner_token = lu.current_owner_token
   and users.line_user_id is null;

-- 4. 動作確認クエリ (任意)
--    -- バックフィル後にまだ NULL が残ってる users (LINE 連携なしユーザーは正常)
--    select count(*) as still_null_users
--      from users where line_user_id is null;
--
--    -- LINE 連携済なのに users.line_user_id NULL が残っていない (= 0 件) ことを確認
--    select count(*) as broken_after
--      from users u
--      join line_users lu on lu.owner_token = u.owner_token
--     where u.line_user_id is null;
--    -- 期待: 0

-- =============================================================
-- End of hotfix-2026-05-18 backfill
-- =============================================================
