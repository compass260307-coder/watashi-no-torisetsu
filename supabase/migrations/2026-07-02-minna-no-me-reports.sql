-- 「みんなの目」タブ: 他者視点AI解説文 (600字前後) の生成結果を保存するテーブル。
--
-- 背景: /me/[token] の深掘り4タブ目「みんなの目」は、友達3人の回答が揃うと解除され、
--       友達平均から導いた「みんなから見たタイプ」＋ Claude 生成の他者視点解説文を表示する。
--       生成はコストがかかるため 1 owner 1 行でキャッシュし、友達が増えたときだけ再生成する。
--
-- 設計:
--   - target_user_id UNIQUE ＝ owner ごとに 1 行 (integrated_trisetsu と違い決済単位ではない)。
--   - friend_count_at_generation ＝ 生成時点の友達回答数。現在数と一致すればキャッシュ再利用、
--     ズレていれば (友達が増えた) 再生成する判定に使う。
--   - status ＝ pending / generating / completed / failed。generating は二重生成防止の claim にも使う。
--   - ai_* ＝ 使用モデル・トークン・コストの記録 (既存 integrated_trisetsu と同じ作法)。
--
-- 安全性:
--   - 新規テーブル追加のみ。既存テーブル・RLS への影響なし。
--   - 書き込み/読み取りはアプリの service role (supabaseAdmin) 経由で RLS をバイパスする。

create table if not exists minna_no_me_reports (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null unique references users(id) on delete cascade,
  generated_text text,
  friend_type_id text,          -- みんなから見た 32 タイプ ID (参考・再計算可)
  top_gap_axis text,            -- 最大乖離軸 (E/A/O/C/N・参考)
  friend_count_at_generation int not null default 0,
  ai_model text,
  ai_input_tokens int,
  ai_output_tokens int,
  ai_cost_usd numeric(10, 6),
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'completed', 'failed')),
  failure_reason text,
  retry_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_minna_no_me_reports_target_user_id
  on minna_no_me_reports(target_user_id);
