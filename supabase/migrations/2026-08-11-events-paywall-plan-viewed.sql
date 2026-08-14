-- 3コース課金カードのコース表示イベント追加 (2026-08-11)
--
-- paywall_plan_viewed は、横スクロールで各コースが中央に一定時間表示された時に
-- 1セッション・設置場所・コースごとに1回送る。CTA率・購入率のコース別分母に使う。
--
-- 適用前でも track.ts が /api/event へフォールバックするため計測は継続する。
-- 本ファイルのイベント名リストを今後の正とし、追加時は全名を残すこと。

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
      'paywall_plan_viewed',
      'paywall_scroll_clicked',
      'purchase_cta_clicked',
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
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
