create extension if not exists pg_cron;

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  role_id text not null check (char_length(role_id) between 1 and 120),
  role_title text not null check (char_length(role_title) between 1 and 160),
  overall_score smallint check (overall_score between 0 and 100),
  answers jsonb not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  expires_at timestamptz not null,
  claim_token_hash text unique,
  claim_email_hash text,
  claim_expires_at timestamptz,
  constraint saved_reports_answers_are_bounded check (
    jsonb_typeof(answers) = 'array'
    and jsonb_array_length(answers) between 1 and 12
    and pg_column_size(answers) <= 65536
  ),
  constraint saved_reports_claim_state_is_consistent check (
    (
      owner_id is null
      and claimed_at is null
      and claim_token_hash is not null
      and claim_email_hash is not null
      and claim_expires_at is not null
    )
    or
    (
      owner_id is not null
      and claimed_at is not null
      and claim_token_hash is null
      and claim_email_hash is null
      and claim_expires_at is null
    )
  )
);

comment on table public.saved_reports is
  'Optional cross-device interview reports. Full candidate answer transcripts are never stored here.';

create index saved_reports_owner_created_idx
  on public.saved_reports (owner_id, created_at desc)
  where owner_id is not null;

create index saved_reports_expiry_idx
  on public.saved_reports (expires_at);

create index saved_reports_unclaimed_expiry_idx
  on public.saved_reports (claim_expires_at)
  where owner_id is null;

revoke all on table public.saved_reports from anon, authenticated;
grant select, delete on table public.saved_reports to authenticated;

alter table public.saved_reports enable row level security;
alter table public.saved_reports force row level security;

create policy "Candidates can read their own saved reports"
  on public.saved_reports
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Candidates can delete their own saved reports"
  on public.saved_reports
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

select cron.schedule(
  'purge-expired-muqabala-reports',
  '17 3 * * *',
  $$delete from public.saved_reports
    where expires_at <= now()
       or (owner_id is null and claim_expires_at <= now())$$
);
