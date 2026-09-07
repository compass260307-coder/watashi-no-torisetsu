-- Keep the four Google Sheets export endpoints on indexed seek-pagination
-- paths. These indexes match each route's (timestamp, id) cursor and exclude
-- rows that the route can never export.

begin;

create index if not exists idx_users_metrics_export_completed_id
  on public.users (diagnosis_completed_at, id)
  where diagnosis_completed_at is not null;

create index if not exists idx_payment_history_metrics_export_updated_id
  on public.payment_history (updated_at, id)
  where status in ('completed', 'refunded')
    and stripe_session_id not like 'cs_test_%'
    and updated_at is not null;

create index if not exists idx_events_share_export_created_id
  on public.events (created_at, id)
  where event_name in (
    'diagnosis_completed',
    'share_ui_shown',
    'share_clicked',
    'share_landing_viewed',
    'share_to_diagnosis_clicked',
    'friend_invite_clicked',
    'friend_landing_viewed',
    'friend_answer_started',
    'friend_answer_completed',
    'friend_to_diagnosis_clicked'
  );

create index if not exists idx_events_product_export_created_id
  on public.events (created_at, id)
  where event_name in (
    'unmei_lp_view',
    'unmei_purchase_start',
    'unmei_reading_view',
    'unmei_checkout_step_view',
    'unmei_purchase_complete_embedded',
    'unmei_purchase_complete',
    'unmei_upgrade_complete',
    'birth_form_view',
    'birth_form_submit',
    'birth_form_skip',
    'unmei_nav_badge_shown',
    'unmei_nav_badge_clicked',
    'hoshiyomi_page_viewed',
    'hoshiyomi_paywall_opened',
    'hoshiyomi_message_sent',
    'hoshiyomi_response_completed',
    'hoshiyomi_response_failed',
    'paywall_viewed',
    'paywall_plan_viewed',
    'paywall_scroll_clicked',
    'purchase_cta_clicked',
    'checkout_session_created',
    'purchase_completed'
  );

commit;
