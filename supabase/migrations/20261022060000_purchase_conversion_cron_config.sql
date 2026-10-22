-- Additive: apply before the new cron worker. Keep the old RPC for webhook
-- delivery and rollback compatibility. No rows or existing privileges change.
begin;

create function public.claim_due_configured_purchase_conversion_deliveries(
  p_limit integer, p_session_id text, p_include_meta boolean
)
returns setof public.purchase_conversion_delivery_outbox
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.prepare_purchase_conversion_deliveries(p_session_id);
  return query
  with due as (
    select queue.id
    from public.purchase_conversion_delivery_outbox queue
    where (p_session_id is null or queue.stripe_session_id = p_session_id)
      and (queue.provider <> 'meta' or p_include_meta is true)
      and queue.paid_at > now() - interval '7 days'
      and (
        (queue.status in ('pending', 'failed') and queue.next_attempt_at <= now())
        or (queue.status = 'processing' and queue.updated_at <= now() - interval '15 minutes')
      )
    order by queue.next_attempt_at, queue.created_at, queue.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.purchase_conversion_delivery_outbox queue
  set status = 'processing', attempts = queue.attempts + 1, updated_at = now()
  from due where queue.id = due.id
  returning queue.*;
end;
$$;

revoke all on function public.claim_due_configured_purchase_conversion_deliveries(integer, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_due_configured_purchase_conversion_deliveries(integer, text, boolean) to service_role;
commit;
