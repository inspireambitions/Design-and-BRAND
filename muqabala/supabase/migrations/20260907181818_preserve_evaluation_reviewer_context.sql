-- Carry reviewer context into the new version in the same transaction.
-- Keep prior notes and names intact. CREATE OR REPLACE preserves function grants.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  previous_report_id uuid;
  previous_interviewer_name text;
begin
  perform 1 from public.interviews where id = p_interview_id for update;
  if not found then return null; end if;

  select (coalesce(max(version), 0) + 1)::smallint
  into expected_version
  from public.candidate_evaluation_reports
  where interview_id = p_interview_id;

  if p_version is distinct from expected_version then return null; end if;

  select id, interviewer_name into previous_report_id, previous_interviewer_name
  from public.candidate_evaluation_reports
  where interview_id = p_interview_id and superseded_at is null
  for update;

  update public.candidate_evaluation_reports
  set superseded_at = now()
  where interview_id = p_interview_id and superseded_at is null;

  insert into public.candidate_evaluation_reports (
    report_id, interview_id, employer_id, version, payload,
    pipeline_version, rubric_version, generated_by, interviewer_name
  ) values (
    p_report_id, p_interview_id, p_employer_id, p_version, p_payload,
    p_pipeline_version, p_rubric_version, p_generated_by, previous_interviewer_name
  ) returning id into stored_id;

  insert into public.evaluation_report_notes (
    report_id, author_id, author_name, note_text, created_at
  )
  select stored_id, author_id, author_name, note_text, created_at
  from public.evaluation_report_notes where report_id = previous_report_id;

  return stored_id;
end;
$$;


-- Reviewer edits use the same interview lock as version creation, then resolve
-- the current version. An edit from an older browser tab cannot target an archive.
create or replace function public.add_current_evaluation_note(
  p_interview_id uuid, p_employer_id uuid, p_author_name text, p_note_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_report_id uuid;
  note_id uuid;
begin
  perform 1 from public.interviews where id = p_interview_id for update;
  if not found then return null; end if;
  select id into current_report_id from public.candidate_evaluation_reports
  where interview_id = p_interview_id and employer_id = p_employer_id
    and superseded_at is null;
  if current_report_id is null then return null; end if;
  insert into public.evaluation_report_notes(report_id, author_id, author_name, note_text)
  values (current_report_id, p_employer_id, p_author_name, p_note_text)
  returning id into note_id;
  return note_id;
end;
$$;

create or replace function public.update_current_evaluation_interviewer(
  p_interview_id uuid, p_employer_id uuid, p_interviewer_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_report_id uuid;
begin
  perform 1 from public.interviews where id = p_interview_id for update;
  if not found then return null; end if;
  update public.candidate_evaluation_reports
  set interviewer_name = nullif(btrim(p_interviewer_name), '')
  where interview_id = p_interview_id and employer_id = p_employer_id
    and superseded_at is null
  returning id into current_report_id;
  return current_report_id;
end;
$$;

revoke all on function public.add_current_evaluation_note(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.add_current_evaluation_note(uuid, uuid, text, text) to service_role;
revoke all on function public.update_current_evaluation_interviewer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_current_evaluation_interviewer(uuid, uuid, text) to service_role;
