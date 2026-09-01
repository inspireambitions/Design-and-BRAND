set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- One pre-aggregated row per submitted employer interview. The report page
-- reads this column instead of joining interview_answers on every load. It is
-- written by the service role at submission and refreshed once the last AI
-- note settles. Older submissions keep a null here and fall back to the
-- per-answer query. The employer select policy on interviews already limits
-- reads to interviews under the employer's own packs, so no policy changes.
alter table public.interviews
  add column if not exists report_summary jsonb,
  add column if not exists report_summary_at timestamptz;

alter table public.interviews
  drop constraint if exists interviews_report_summary_object;

alter table public.interviews
  add constraint interviews_report_summary_object
  check (report_summary is null or jsonb_typeof(report_summary) = 'object');

comment on column public.interviews.report_summary is
  'Service-role-written copy of the submitted answers (question, transcript, AI note, status, video path, duration) for one-row employer report reads. Never a decision.';
comment on column public.interviews.report_summary_at is
  'Time report_summary was last rebuilt from interview_answers.';
