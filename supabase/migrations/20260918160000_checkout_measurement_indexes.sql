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

-- 既存データには通信再送による重複があるため、データは削除せず
-- 参照用インデックのみ追加する。集計は checkout_attempt_id で重複を除外する。
create index if not exists events_checkout_cancelled_attempt_idx
  on public.events (((metadata ->> 'checkout_attempt_id')))
  where event_name = 'checkout_cancelled'
  and metadata ->> 'checkout_attempt_id' is not null;

create index if not exists events_checkout_requested_attempt_idx
  on public.events (((metadata ->> 'checkout_attempt_id')))
  where event_name = 'checkout_requested'
  and metadata ->> 'checkout_attempt_id' is not null;

commit;
