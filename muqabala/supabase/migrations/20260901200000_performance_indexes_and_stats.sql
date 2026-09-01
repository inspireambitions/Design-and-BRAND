set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Performance brief, Section 7: query statistics, indexes and Row Level
-- Security review. Written, not applied. Apply with `supabase db push` after
-- review.

-- 1. Query statistics.
-- Supabase enables pg_stat_statements on every project by default, so this is
-- a no-op there. The guard keeps the migration valid on a plain Postgres
-- (local `supabase start`, CI) where the extension may be missing.
create extension if not exists pg_stat_statements;

-- 2. Indexes for the columns the app filters, orders or joins on.
--
-- Already indexed by earlier migrations (not repeated here):
--   interviews: (user_id, status, updated_at desc); (anonymous_token_hash);
--     (expires_at) where saved = false; (screening_pack_id, submitted_at desc);
--     (screening_pack_id, candidate_user_id) unique; (candidate_user_id);
--     (screening_pack_id, start_idempotency_hash) unique;
--     (screening_pack_id, employer_reviewed_at, submitted_at desc).
--   interview_answers: (interview_id, question_index) unique; (video_path) unique.
--   report_shares: (token_hash) unique; (user_id, created_at desc);
--     (expires_at) where revoked_at is null; (interview_id).
--   screening_packs: (public_code) unique; (expires_at);
--     (employer_id, created_at desc) where employer_id is not null.
--   screening_notification_outbox: (interview_id, event_type, recipient_kind)
--     unique; (available_at, created_at) where status in (pending, processing);
--     (recipient_user_id).
--   auth_claims: (state_hash) unique; (expires_at); (interview_id).

-- app/api/interviews/route.ts looks a pack up by its signed token when a
-- candidate starts: .eq('signed_token', token). Tokens can run to several
-- kilobytes, past the B-tree row limit, so a hash index serves the equality.
create index if not exists screening_packs_signed_token_hash_idx
  on public.screening_packs using hash (signed_token);

-- app/employer/page.tsx, every load: interrupted uploads are the pending
-- answers for unfinished interviews, filtered by updated_at. Partial index
-- keeps it to the handful of rows that are actually pending.
create index if not exists interview_answers_pending_upload_idx
  on public.interview_answers (interview_id, updated_at)
  where video_upload_status = 'pending';

-- app/employer/page.tsx paginates submissions by submitted_at desc with
-- .range(). The pack-scoped index above serves one pack; this one serves the
-- top-N sort across an employer's packs.
create index if not exists interviews_submitted_recent_idx
  on public.interviews (submitted_at desc)
  where mode = 'screening' and submitted_at is not null;

-- Hourly cron deletes revoked shares seven days on. The existing expiry index
-- excludes revoked rows, so that half of the predicate was a full scan.
create index if not exists report_shares_revoked_idx
  on public.report_shares (revoked_at)
  where revoked_at is not null;

-- 3. Row Level Security review.
-- Every table holding candidate or employer data already has RLS enabled:
--   interviews, interview_answers, report_shares (20260823111300),
--   screening_packs (20260828120000), auth_claims (20260823141546),
--   screening_notification_outbox (20260901040619).
-- auth_claims and screening_notification_outbox have no policies at all, which
-- under RLS means deny-by-default for anon and authenticated; only the service
-- role reaches them. No table needed RLS added.
--
-- Policy predicates and the index that serves each:
--   interviews.user_id = auth.uid()            -> interviews_user_status_idx
--   screening_packs.employer_id = auth.uid()   -> screening_packs_employer_created_idx
--   screening_packs.id = interviews.screening_pack_id
--                                              -> screening_packs pkey,
--                                                 interviews_screening_pack_submitted_idx
--   interviews.id = interview_answers.interview_id
--                                              -> interviews pkey,
--                                                 interview_answers unique (interview_id, question_index)
--   report_shares.user_id = auth.uid()         -> report_shares_owner_idx
-- No policy column is unindexed, so no index is added for RLS.

-- 4. Operator query: statements over 100 ms since the last reset. Run in the
-- Supabase SQL editor after a load test against a preview project. Reset with
-- `select pg_stat_statements_reset();` before the run.
--
-- select
--   round(mean_exec_time::numeric, 1) as mean_ms,
--   round(max_exec_time::numeric, 1) as max_ms,
--   calls,
--   round(total_exec_time::numeric, 0) as total_ms,
--   rows,
--   left(query, 200) as query
-- from pg_stat_statements
-- where mean_exec_time > 100
--   and query not ilike '%pg_stat_statements%'
-- order by mean_exec_time desc
-- limit 50;
