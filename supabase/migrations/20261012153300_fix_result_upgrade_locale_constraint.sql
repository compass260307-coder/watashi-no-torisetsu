-- Correct the already-applied 20261009222340 migration without rewriting history.
-- Replace either the Japanese/Thai or Japanese/Korean check with their union.
-- Existing answers, default locale, RLS, policies and grants remain unchanged.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.result_upgrades
  add column if not exists locale text not null default 'ja';

alter table public.result_upgrades
  drop constraint if exists result_upgrades_locale_check;

alter table public.result_upgrades
  add constraint result_upgrades_locale_check
    check (locale in ('ja', 'th', 'ko'));

-- Validation above and replacement are atomic: unsupported existing values
-- abort the transaction and restore the previous constraint, without data edits.
notify pgrst, 'reload schema';

commit;
