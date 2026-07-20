-- events のクライアント直送化 (2026-07-20 / Vercel コスト削減)
--
-- 背景: 計測イベントは /api/event (Vercel Function) 経由で insert していたが、
--   1イベント = 1 Function 起動 + Edge Request + Observability Events となり課金が嵩む。
--   → src/lib/track.ts をブラウザ → Supabase REST 直接 insert (anon key + バッチ) に変更。
--   これに伴い、サーバ側で行っていた検証 (イベント名ホワイトリスト・形式チェック) を
--   RLS ポリシーの with check に移す。
--
-- 適用: Supabase SQL Editor で本ファイルを実行する (自動適用はされない)。
-- 注意:
--   - service_role (旧 /api/event・サーバ発行イベント・admin 集計) は RLS を
--     バイパスするため影響なし。
--   - IP/セッション単位のレートリミット (consume_api_rate_limit) は直送経路では
--     効かなくなる。events は低機微データであり、KPI 汚染リスクは許容する判断。

-- 1. 全開だった select ポリシーを撤去。
--    (anon key で全 events 行 — owner_token / invite_code 含む — が読めてしまっていた。
--     集計はすべて service_role 経由なので、クライアント read は不要。)
drop policy if exists "anyone can read events" on public.events;

-- 2. 無条件 insert を検証付き insert に置き換える。
--    条件は旧 /api/event (src/app/api/event/route.ts) の検証と同等:
--    イベント名ホワイトリスト / locale / 識別子の形式・長さ / metadata の形と大きさ。
drop policy if exists "anyone can insert events" on public.events;

create policy "client can insert validated events" on public.events
  for insert to anon
  with check (
    event_name in (
      'top_viewed',
      'top_cta_clicked',
      'diagnosis_started',
      'diagnosis_question_answered',
      'diagnosis_completed',
      'friend_landing_viewed',
      'friend_answer_started',
      'friend_answer_scale_completed',
      'friend_answer_completed',
      'friend_to_diagnosis_clicked',
      'friend_to_diagnosis_invite_clicked',
      'friend_invite_clicked',
      'share_clicked',
      'result_viewed',
      'result_revisited',
      'three_friends_unlocked',
      'tako_nav_badge_shown',
      'tako_nav_badge_clicked',
      'tako_viewed',
      'paywall_viewed',
      'paywall_scroll_clicked',
      'purchase_cta_clicked',
      -- track.ts から送られる占い/出生フォーム系 (旧 API では未列挙だったが実送信あり)
      'uranai_interstitial_view',
      'uranai_interstitial_close',
      'uranai_interstitial_cta',
      'birth_form_view',
      'birth_form_submit',
      'birth_form_skip'
    )
    and locale in ('ja', 'ko')
    and (session_id is null or session_id ~ '^[A-Za-z0-9_-]{1,128}$')
    and (invite_code is null or invite_code ~ '^[A-Za-z0-9_-]{1,128}$')
    and (owner_token is null or owner_token ~ '^[A-Za-z0-9_-]{1,128}$')
    and jsonb_typeof(coalesce(metadata, '{}'::jsonb)) = 'object'
    and pg_column_size(metadata) < 8192
    -- created_at のクライアント偽装 (過去/未来日時での KPI 汚染) を防ぐ。default now() は通る。
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
