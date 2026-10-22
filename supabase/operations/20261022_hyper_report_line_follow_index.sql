-- Run ALONE before 20261022050000_hyper_report_aggregates.sql.
-- No BEGIN/COMMIT, migration runner, or multi-statement transaction wrapper.
-- Verify the existing definition and pg_index.indisvalid/indisready afterward.
create index concurrently if not exists idx_events_hyper_line_follow_user_created
  on public.events ((metadata->>'line_user_id'), created_at)
  where event_name='line_follow';
