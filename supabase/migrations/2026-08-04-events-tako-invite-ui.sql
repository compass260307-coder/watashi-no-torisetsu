-- 招待送信UIの露出イベント追加 (2026-08-04)
--
-- tako_invite_ui_shown を events のクライアント直送 (anon insert) ポリシーの
-- 許可リストへ追加する。招待未実行 (/tako到達者の約8割) を
-- 「送信UIまで到達していない」/「見たのに送らない」に分解するための計測。
--
-- ※ 本ファイルは 2026-07-27 の2枚 (events-unmei-page.sql / events-unmei-nav-badge.sql)
--   の「統合版」でもある。2枚はイベント名リストが食い違っており
--   (nav-badge 版には unmei_lp_view / unmei_purchase_start / unmei_reading_view が無い)、
--   後から実行した方が他方の名前を落とす状態だった。以後はこのファイルの
--   リストを正とし、追加時は必ず全名を含めて drop+create すること。
--
-- 適用: Supabase SQL Editor で本ファイルを実行する (自動適用はされない)。
-- 適用前でも計測は落ちない: RLS 拒否時は track.ts が旧 /api/event へ
-- フォールバックし、そちらの許可リストには追加済み。

drop policy if exists "client can insert validated events" on public.events;

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
      'tako_invite_ui_shown',
      'unmei_nav_badge_shown',
      'unmei_nav_badge_clicked',
      'unmei_lp_view',
      'unmei_purchase_start',
      'unmei_reading_view',
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
