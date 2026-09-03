set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists candidate_evaluation_reports_generated_by_idx
  on public.candidate_evaluation_reports (generated_by)
  where generated_by is not null;

create index if not exists evaluation_report_notes_author_idx
  on public.evaluation_report_notes (author_id);

create index if not exists evaluation_report_shares_creator_idx
  on public.evaluation_report_shares (created_by);

create index if not exists evaluation_report_access_actor_idx
  on public.evaluation_report_access_log (actor_user_id)
  where actor_user_id is not null;
