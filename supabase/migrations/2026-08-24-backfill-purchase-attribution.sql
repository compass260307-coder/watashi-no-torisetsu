-- Make historical payment and purchase rows independently auditable even when
-- the client-side purchase event is missing. Checkout Session metadata is the
-- authoritative attribution captured before redirecting to Stripe.

begin;

with checkout_events as (
  select distinct on (e.metadata ->> 'stripe_session_id')
    e.metadata ->> 'stripe_session_id' as stripe_session_id,
    e.metadata
  from public.events as e
  where e.event_name = 'checkout_session_created'
    and nullif(e.metadata ->> 'stripe_session_id', '') is not null
  order by e.metadata ->> 'stripe_session_id', e.created_at asc, e.id asc
)
update public.payment_history as payment
set metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
  'product', coalesce(
    checkout.metadata ->> 'product',
    payment.metadata ->> 'product',
    payment.payment_kind
  ),
  'source', coalesce(
    checkout.metadata ->> 'source',
    payment.metadata ->> 'source',
    'direct'
  ),
  'paywall_version', coalesce(
    checkout.metadata ->> 'paywall_version',
    payment.metadata ->> 'paywall_version',
    'legacy'
  ),
  'placement', coalesce(
    checkout.metadata ->> 'placement',
    payment.metadata ->> 'placement',
    'unknown'
  ),
  'return_to', coalesce(
    checkout.metadata ->> 'return_to',
    payment.metadata ->> 'return_to',
    'me'
  ),
  'locale', coalesce(
    checkout.metadata ->> 'locale',
    payment.metadata ->> 'locale',
    'ja'
  )
)
from checkout_events as checkout
where payment.stripe_session_id = checkout.stripe_session_id;

with checkout_events as (
  select distinct on (e.metadata ->> 'stripe_session_id')
    e.metadata ->> 'stripe_session_id' as stripe_session_id,
    e.metadata
  from public.events as e
  where e.event_name = 'checkout_session_created'
    and nullif(e.metadata ->> 'stripe_session_id', '') is not null
  order by e.metadata ->> 'stripe_session_id', e.created_at asc, e.id asc
), purchase_rows as (
  select
    purchase.id,
    checkout.metadata as checkout_metadata,
    payment.paid_at
  from public.events as purchase
  join checkout_events as checkout
    on checkout.stripe_session_id = purchase.metadata ->> 'stripe_session_id'
  left join public.payment_history as payment
    on payment.stripe_session_id = checkout.stripe_session_id
  where purchase.event_name in (
    'purchase_completed',
    'unmei_purchase_complete',
    'unmei_upgrade_complete'
  )
)
update public.events as purchase
set
  metadata = coalesce(purchase.metadata, '{}'::jsonb) || jsonb_build_object(
    'source', coalesce(
      rows.checkout_metadata ->> 'source',
      purchase.metadata ->> 'source',
      'direct'
    ),
    'paywall_version', coalesce(
      rows.checkout_metadata ->> 'paywall_version',
      purchase.metadata ->> 'paywall_version',
      'legacy'
    ),
    'placement', coalesce(
      rows.checkout_metadata ->> 'placement',
      purchase.metadata ->> 'placement',
      'unknown'
    ),
    'return_to', coalesce(
      rows.checkout_metadata ->> 'return_to',
      purchase.metadata ->> 'return_to',
      'me'
    )
  ),
  created_at = coalesce(rows.paid_at, purchase.created_at)
from purchase_rows as rows
where purchase.id = rows.id;

commit;
