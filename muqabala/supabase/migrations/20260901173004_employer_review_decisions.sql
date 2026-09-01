set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.interviews
  add column if not exists employer_reviewed_at timestamptz,
  add column if not exists employer_decision text,
  add column if not exists employer_decided_at timestamptz;

alter table public.interviews
  drop constraint if exists interviews_employer_decision_check;

alter table public.interviews
  add constraint interviews_employer_decision_check
  check (employer_decision is null or employer_decision in ('shortlisted', 'not_proceeding'));

create index if not exists interviews_employer_review_queue_idx
  on public.interviews (screening_pack_id, employer_reviewed_at, submitted_at desc)
  where mode = 'screening' and submitted_at is not null;

comment on column public.interviews.employer_reviewed_at is
  'Time the owning employer first opened the submitted interview evidence.';
comment on column public.interviews.employer_decision is
  'Optional human decision recorded by the owning employer. Never set automatically.';
comment on column public.interviews.employer_decided_at is
  'Time the owning employer recorded the current human decision.';
