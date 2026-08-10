-- Speed up the read-only admin/metrics aggregation over the growing events table.
-- The first index supports event_name filters with stable created_at/id paging.
-- The second prevents 50 question-reach counts from scanning the full table.

create index if not exists idx_events_event_name_created_at_id
  on public.events(event_name, created_at, id);

create index if not exists idx_events_question_reach
  on public.events(event_name, (metadata ->> 'questionId'), created_at);
