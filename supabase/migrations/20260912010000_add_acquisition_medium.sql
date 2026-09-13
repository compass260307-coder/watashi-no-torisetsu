-- Apply before deploying the acquisition-medium application/export changes.
-- Nullable, no default/backfill: historical source/campaign cannot prove medium.
-- Remote REST schema checked 2026-09-12: users has source/campaign, no medium.
-- Remote migration history is not exposed through REST; check with release credentials before applying.
begin;

alter table public.users add column acquisition_medium text;
alter table public.users add constraint users_acquisition_medium_length
  check (acquisition_medium is null or char_length(acquisition_medium) <= 100);

comment on column public.users.acquisition_medium is
  'Observed utm_medium from the same acquisition touch as source/campaign. NULL means unknown; never infer from campaign or referrer.';

commit;
