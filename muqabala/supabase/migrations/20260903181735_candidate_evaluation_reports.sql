set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.candidate_evaluation_reports (
  id uuid primary key default gen_random_uuid(),
  report_id text not null unique check (report_id ~ '^EVAL-[0-9]{4}-[A-F0-9]{8}$'),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  employer_id uuid not null references auth.users(id) on delete cascade,
  version smallint not null check (version between 1 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  pipeline_version text not null check (char_length(pipeline_version) between 3 and 80),
  rubric_version text not null check (char_length(rubric_version) between 1 and 80),
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (interview_id, version)
);

create unique index candidate_evaluation_reports_current_idx
  on public.candidate_evaluation_reports (interview_id)
  where superseded_at is null;

create index candidate_evaluation_reports_employer_idx
  on public.candidate_evaluation_reports (employer_id, created_at desc);

create table public.evaluation_report_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.candidate_evaluation_reports(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 100),
  note_text text not null check (char_length(note_text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index evaluation_report_notes_report_idx
  on public.evaluation_report_notes (report_id, created_at);

create table public.evaluation_report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.candidate_evaluation_reports(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);

create index evaluation_report_shares_report_idx
  on public.evaluation_report_shares (report_id, created_at desc);

create table public.evaluation_report_access_log (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.candidate_evaluation_reports(id) on delete cascade,
  report_version smallint not null check (report_version between 1 and 100),
  action text not null check (action in ('VIEW', 'DOWNLOAD', 'SHARE_CREATED', 'SHARE_REVOKED')),
  actor_user_id uuid references auth.users(id) on delete set null,
  viewer_email_hash text check (viewer_email_hash is null or viewer_email_hash ~ '^[0-9a-f]{64}$'),
  viewer_email_ciphertext text check (viewer_email_ciphertext is null or char_length(viewer_email_ciphertext) between 20 and 1000),
  created_at timestamptz not null default now()
);

create index evaluation_report_access_log_report_idx
  on public.evaluation_report_access_log (report_id, created_at desc);

alter table public.candidate_evaluation_reports enable row level security;
alter table public.evaluation_report_notes enable row level security;
alter table public.evaluation_report_shares enable row level security;
alter table public.evaluation_report_access_log enable row level security;

revoke all on public.candidate_evaluation_reports from public, anon, authenticated;
revoke all on public.evaluation_report_notes from public, anon, authenticated;
revoke all on public.evaluation_report_shares from public, anon, authenticated;
revoke all on public.evaluation_report_access_log from public, anon, authenticated;

grant select on public.candidate_evaluation_reports to authenticated;
grant select on public.evaluation_report_notes to authenticated;
grant select on public.evaluation_report_shares to authenticated;
grant all on public.candidate_evaluation_reports to service_role;
grant all on public.evaluation_report_notes to service_role;
grant all on public.evaluation_report_shares to service_role;
grant all on public.evaluation_report_access_log to service_role;
grant usage, select on sequence public.evaluation_report_access_log_id_seq to service_role;

create policy "Employers can read their evaluation reports"
  on public.candidate_evaluation_reports for select to authenticated
  using (employer_id = (select auth.uid()));

create policy "Employers can read their evaluation notes"
  on public.evaluation_report_notes for select to authenticated
  using (exists (
    select 1 from public.candidate_evaluation_reports report
    where report.id = evaluation_report_notes.report_id
      and report.employer_id = (select auth.uid())
  ));

create policy "Employers can read their evaluation shares"
  on public.evaluation_report_shares for select to authenticated
  using (exists (
    select 1 from public.candidate_evaluation_reports report
    where report.id = evaluation_report_shares.report_id
      and report.employer_id = (select auth.uid())
  ));

create or replace function public.store_candidate_evaluation_report(
  p_report_id text,
  p_interview_id uuid,
  p_employer_id uuid,
  p_version smallint,
  p_payload jsonb,
  p_pipeline_version text,
  p_rubric_version text,
  p_generated_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_version smallint;
  stored_id uuid;
begin
  perform 1 from public.interviews where id = p_interview_id for update;
  if not found then return null; end if;

  select (coalesce(max(version), 0) + 1)::smallint
  into expected_version
  from public.candidate_evaluation_reports
  where interview_id = p_interview_id;

  if p_version is distinct from expected_version then return null; end if;

  update public.candidate_evaluation_reports
  set superseded_at = now()
  where interview_id = p_interview_id and superseded_at is null;

  insert into public.candidate_evaluation_reports (
    report_id, interview_id, employer_id, version, payload,
    pipeline_version, rubric_version, generated_by
  ) values (
    p_report_id, p_interview_id, p_employer_id, p_version, p_payload,
    p_pipeline_version, p_rubric_version, p_generated_by
  ) returning id into stored_id;

  return stored_id;
end;
$$;

revoke all on function public.store_candidate_evaluation_report(
  text, uuid, uuid, smallint, jsonb, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.store_candidate_evaluation_report(
  text, uuid, uuid, smallint, jsonb, text, text, uuid
) to service_role;

comment on table public.candidate_evaluation_reports is
  'Immutable, versioned employer evaluation snapshots generated only from stored evidence records.';
comment on table public.evaluation_report_notes is
  'Append-only employer notes. The application never updates or deletes note rows.';
comment on table public.evaluation_report_shares is
  'Revocable, decision-gated links to one stored report version.';
comment on table public.evaluation_report_access_log is
  'Service-only audit trail. Viewer email addresses are encrypted and never placed in URLs.';
