begin;

-- Checkoutの各段を同じ試行IDで高速に突合する。event_nameを先頭に置き、
-- 他の大量イベントをインデックスへ含めない。
create index if not exists events_checkout_attempt_lookup_idx
  on public.events (event_name, ((metadata ->> 'checkout_attempt_id')))
  where event_name in (
    'checkout_requested',
    'checkout_session_created',
    'checkout_cancelled',
    'purchase_completed'
  )
  and metadata ->> 'checkout_attempt_id' is not null;

-- React Strict Mode・再読込・通信再送が重なってもキャンセルは1試行1行にする。
create unique index if not exists events_checkout_cancelled_attempt_uidx
  on public.events (((metadata ->> 'checkout_attempt_id')))
  where event_name = 'checkout_cancelled'
  and metadata ->> 'checkout_attempt_id' is not null;

create unique index if not exists events_checkout_requested_attempt_uidx
  on public.events (((metadata ->> 'checkout_attempt_id')))
  where event_name = 'checkout_requested'
  and metadata ->> 'checkout_attempt_id' is not null;

commit;
