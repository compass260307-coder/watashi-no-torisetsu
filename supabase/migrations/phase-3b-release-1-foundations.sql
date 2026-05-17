-- =================================================================
-- Phase 3-β リリース 1: 基盤マイグレーション
--   - 「他者から見た私のトリセツ」コレクション + AI 統合の土台
--   - すべて追加のみ (CREATE / ALTER ADD)、既存テーブル削除なし
--   - IF NOT EXISTS で再実行安全 (idempotent)
--   - RLS は既存 lockdown 方針を継承 (anon 全閉、service_role only)
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
--
-- 内容:
--   1. users.line_user_id 追加 + バックフィル
--   2. line_users.current_owner_token 追加 + バックフィル
--   3. friend_perceptions テーブル新設
--   4. integrated_trisetsu テーブル新設
--   5. notification_preferences テーブル新設
--   6. line_messages_sent テーブル新設
-- =================================================================


-- =============================================================
-- 1. users.line_user_id 追加
-- =============================================================
-- どの LINE userId が診断したかを users 行に直接記録。
-- 既存 line_users テーブルからバックフィル可能 (owner_token 経由)。
alter table users
  add column if not exists line_user_id text null;

create index if not exists idx_users_line_user_id
  on users(line_user_id);

-- バックフィル: 既存 users 行の line_user_id を line_users から逆引きして埋める。
-- 同じ owner_token に複数 line_users が紐付くケースは現状想定なし (LIFF 登録 1 回 = 1 行)。
update users
   set line_user_id = lu.line_user_id
  from line_users lu
 where users.owner_token = lu.owner_token
   and users.line_user_id is null;


-- =============================================================
-- 2. line_users.current_owner_token 追加
-- =============================================================
-- 「常に最新の診断」を指すポインタ。再診断時に A-2 が更新する。
-- 既存 line_users.owner_token は当面残し (後方互換)、将来の移行完了後に
-- 廃止検討。今回は触らない。
alter table line_users
  add column if not exists current_owner_token text;

create index if not exists idx_line_users_current_owner_token
  on line_users(current_owner_token);

-- バックフィル: 既存 line_users 行の current は今の owner_token と同一に。
update line_users
   set current_owner_token = owner_token
 where current_owner_token is null;


-- =============================================================
-- 3. friend_perceptions テーブル新設
-- =============================================================
-- 友達 1 評価 = 1 行。friend_answers の生回答から派生計算したスナップショット。
-- マイ図鑑表示はこのテーブルだけ見れば十分 (再計算不要)。
-- 論点 1 (c): 旧 13 問形式の既存 friend_answers はアーカイブし、本テーブルには
--             投入しない (空テーブルで開始、新規 30 問評価のみ insert)。
-- 論点 3   : 通知重複防止に notified_at カラム (NULL=未通知 / timestamp=送信済).
create table if not exists friend_perceptions (
  id uuid primary key default gen_random_uuid(),

  -- 評価対象 (= owner) の users 行 ID
  target_user_id uuid not null references users(id) on delete cascade,

  -- 評価者 (friend) の表示名 (LIFF 経由なら LINE プロフィール由来)
  perceiver_name text not null,

  -- 評価者自身も診断ユーザーなら users.id を埋める (双方向グラフ用、任意)
  perceiver_user_id uuid null references users(id) on delete set null,

  -- 評価者の LINE userId (LINE 連携あり時のみ、任意)
  perceiver_line_user_id text null,

  -- 計算結果 (自己診断の DiagnosisResult と同じ粒度)
  perceived_type_id text not null,             -- 例: "festival-sun"
  perceived_modifier_c_f text not null,        -- 'C' or 'F'
  perceived_modifier_n_r text not null,        -- 'N' or 'R'
  perceived_full_code text not null,           -- 例: "EAO-C-N"
  perceived_modifier_label text not null,      -- 例: "計画 × 繊細"
  perceived_modifier_paragraph text not null,  -- 約 150 字 (生成時点でスナップショット)

  perceived_scores jsonb not null,             -- {E,A,O,C,N} 0-10
  perceived_facet_scores jsonb not null,       -- 10 facet 0-10

  -- 論点 2 (c) 反映: 30 問の後に出すおまけ choice 3 問 (スキップ可)
  -- スキーマ例: { "好きなところ": "...", "動物": "...", "印象シーン": "..." }
  -- 各キーは任意 / 全スキップ時は qualitative_data 自体が NULL
  qualitative_data jsonb null,

  -- 元データへの参照 (friend_answers 削除で本行も cascade 消去)
  friend_answer_id uuid null references friend_answers(id) on delete cascade,

  -- LINE 通知送信済フラグ (論点 3 重複防止用)
  notified_at timestamptz null,

  created_at timestamptz default now()
);

create index if not exists idx_friend_perceptions_target
  on friend_perceptions(target_user_id);

create index if not exists idx_friend_perceptions_perceiver_line
  on friend_perceptions(perceiver_line_user_id);

create index if not exists idx_friend_perceptions_notified
  on friend_perceptions(notified_at);

create index if not exists idx_friend_perceptions_friend_answer
  on friend_perceptions(friend_answer_id);

-- RLS 有効化 (anon policy 作成せず = service_role only でアクセス可)
alter table friend_perceptions enable row level security;


-- =============================================================
-- 4. integrated_trisetsu テーブル新設
-- =============================================================
-- AI 統合トリセツのスナップショット。履歴化されるので同じ user_id で複数行 OK。
create table if not exists integrated_trisetsu (
  id uuid primary key default gen_random_uuid(),

  -- 統合トリセツが帰属する診断 (= users 1 行)
  user_id uuid not null references users(id) on delete cascade,

  -- 検索高速化用 (検索条件: 特定 LINE ユーザーの全統合トリセツ)
  line_user_id text null,

  -- 統合元
  include_self boolean default true,
  perception_ids uuid[] not null,              -- friend_perceptions.id の配列
  source_summary jsonb not null,               -- {self:{fullCode,name}, perceptions:[{name,fullCode},…]}

  -- AI 生成結果
  generated_title text null,                   -- 例: "○○さんの真のトリセツ"
  generated_summary text null,                 -- 1-2 行サマリー
  generated_body text not null,                -- 本文 ~500字

  -- メタデータ (コスト計測 + モデル切替時の比較用)
  ai_model text not null default 'claude-haiku-4-5-20251001',
  ai_input_tokens int null,
  ai_output_tokens int null,
  ai_cost_usd numeric(10, 6) null,             -- マイクロセント精度

  generated_at timestamptz default now()
);

create index if not exists idx_integrated_trisetsu_user
  on integrated_trisetsu(user_id);

create index if not exists idx_integrated_trisetsu_line
  on integrated_trisetsu(line_user_id);

create index if not exists idx_integrated_trisetsu_generated_at
  on integrated_trisetsu(generated_at desc);

alter table integrated_trisetsu enable row level security;


-- =============================================================
-- 5. notification_preferences テーブル新設
-- =============================================================
-- カテゴリ別 ON/OFF。LINE userId 単位 (= 同じ LINE ユーザーの再診断後も設定が引き継がれる)。
-- デフォルトは全 ON。論点 5 (a): unfollow で全 OFF、再 follow で全 ON に戻す挙動は A-3 側で実装。
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,

  enable_welcome boolean default true,
  enable_diagnosis_complete boolean default true,
  enable_friend_perception boolean default true,
  enable_reminder boolean default true,
  enable_broadcast boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notification_prefs_line
  on notification_preferences(line_user_id);

alter table notification_preferences enable row level security;


-- =============================================================
-- 6. line_messages_sent テーブル新設 (送信履歴 / 監査ログ)
-- =============================================================
-- 全 LINE 配信を記録。重複防止 (D-8) と運用分析 (D-14, D-15) の両方に使う。
create table if not exists line_messages_sent (
  id uuid primary key default gen_random_uuid(),

  line_user_id text not null,
  user_id uuid null references users(id) on delete set null,

  message_type text not null,    -- 'welcome' | 'diagnosis_complete' | 'friend_perception_received'
                                  --  | 'reminder_pending_eval' | 'broadcast' | 'integrated_complete' 等
  message_subtype text null,     -- 例: 'N1' / 'N2' / 'N3'

  flex_content jsonb null,       -- 送信した Flex / text の内容
  send_result text not null,     -- 'success' | 'failed' | 'blocked' | 'rate_limited'
  error_detail text null,

  sent_at timestamptz default now()
);

create index if not exists idx_line_messages_line_user
  on line_messages_sent(line_user_id);

create index if not exists idx_line_messages_sent_at
  on line_messages_sent(sent_at desc);

create index if not exists idx_line_messages_type
  on line_messages_sent(message_type);

alter table line_messages_sent enable row level security;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- 以下を実行して、6 つの追加が想定どおりかチェック:
--
--   -- 1. users.line_user_id 追加 + バックフィル件数
--   select count(*) filter (where line_user_id is not null) as backfilled,
--          count(*) filter (where line_user_id is null) as still_null
--     from users;
--
--   -- 2. line_users.current_owner_token バックフィル
--   select count(*) filter (where current_owner_token is not null) as backfilled,
--          count(*) filter (where current_owner_token is null) as still_null
--     from line_users;
--
--   -- 3-6. 新規テーブルが空でも存在することを確認
--   select count(*) from friend_perceptions;       -- 0 想定
--   select count(*) from integrated_trisetsu;      -- 0 想定
--   select count(*) from notification_preferences; -- 0 想定
--   select count(*) from line_messages_sent;       -- 0 想定
--
-- =============================================================
-- End of Phase 3-β リリース 1 マイグレーション
-- =============================================================
