-- Preserve existing Japanese upgrades and allow Korean purchaser-only upgrades.
-- Additive only: no entitlement, RLS, policy, or grant changes.
alter table public.result_upgrades
  add column if not exists locale text not null default 'ja';

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.result_upgrades'::regclass
      and conname = 'result_upgrades_locale_check'
  ) then
    alter table public.result_upgrades
      add constraint result_upgrades_locale_check check (locale in ('ja', 'ko'));
  end if;
end
$migration$;

comment on column public.result_upgrades.locale is
  'Language of saved answers and personalized result. Existing upgrades default to Japanese.';

notify pgrst, 'reload schema';
