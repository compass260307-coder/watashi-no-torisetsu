-- LINE Alice導線と埋め込み運命決済のクライアント計測をSupabaseへ直接送る。
-- 未許可イベントがバッチに1件でもあると全行が拒否され、Vercel APIへ
-- 1件ずつフォールバックするため、現行クライアントの全イベント名を維持する。

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
      'share_ui_shown',
      'share_landing_viewed',
      'share_to_diagnosis_clicked',
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
      'unmei_checkout_step_view',
      'unmei_purchase_complete_embedded',
      'paywall_viewed',
      'paywall_plan_viewed',
      'paywall_scroll_clicked',
      'purchase_cta_clicked',
      'uranai_interstitial_view',
      'uranai_interstitial_close',
      'uranai_interstitial_cta',
      'birth_form_view',
      'birth_form_submit',
      'birth_form_skip',
      'hoshiyomi_page_viewed',
      'hoshiyomi_paywall_opened',
      'hoshiyomi_message_sent',
      'hoshiyomi_response_completed',
      'hoshiyomi_response_failed',
      'line_alice_card_viewed',
      'line_alice_add_friend_clicked',
      'line_alice_link_code_requested',
      'line_alice_link_code_issued',
      'line_alice_link_code_failed'
    )
    and locale in ('ja', 'ko')
    and (session_id is null or session_id ~ '^[A-Za-z0-9_-]{1,128}$')
    and (invite_code is null or invite_code ~ '^[A-Za-z0-9_-]{1,128}$')
    and (owner_token is null or owner_token ~ '^[A-Za-z0-9_-]{1,128}$')
    and jsonb_typeof(coalesce(metadata, '{}'::jsonb)) = 'object'
    and pg_column_size(metadata) < 8192
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
