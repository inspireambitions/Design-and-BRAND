-- Educator Suite P0-A: Institutional Career-Readiness Foundations
-- Safe, additive, backward-compatible schema extension for multi-industry employability.
begin;

-- 1. Flexible Organisational Structure (Optional dimensions: Campus, Faculty, Programme)
alter table public.schools_cohorts
  add column if not exists campus text check (campus is null or length(trim(campus)) between 1 and 160),
  add column if not exists faculty text check (faculty is null or length(trim(faculty)) between 1 and 160),
  add column if not exists programme text check (programme is null or length(trim(programme)) between 1 and 160);

create index if not exists schools_cohorts_taxonomy
  on public.schools_cohorts(institution_id, faculty, programme);

-- 2. Student Identifier for Cohort Rosters
alter table public.schools_cohort_members
  add column if not exists student_identifier text check (student_identifier is null or length(trim(student_identifier)) between 1 and 64);

create index if not exists schools_members_student_id
  on public.schools_cohort_members(cohort_id, student_identifier)
  where student_identifier is not null;

-- 3. Multi-Industry Assignment Engine Attributes
alter table public.schools_assignments
  add column if not exists industry text check (industry is null or length(trim(industry)) between 1 and 80),
  add column if not exists job_title text check (job_title is null or length(trim(job_title)) between 1 and 160),
  add column if not exists job_description text check (job_description is null or length(trim(job_description)) between 1 and 50000),
  add column if not exists competencies jsonb not null default '[]'::jsonb check (jsonb_typeof(competencies) = 'array'),
  add column if not exists max_attempts integer check (max_attempts is null or (max_attempts between 1 and 20));

-- 4. Relax Question Count Constraint to Support 3 to 8 Questions
alter table public.schools_assignment_questions
  drop constraint if exists schools_assignment_questions_question_index_check;

alter table public.schools_assignment_questions
  add constraint schools_assignment_questions_question_index_check
  check (question_index between 0 and 7);

-- 5. Update schools_manage to handle optional hierarchy and 3-8 questions
create or replace function public.schools_manage(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare institution uuid; cohort uuid; founder boolean; administrator boolean; adviser boolean;
  result jsonb; created uuid; item jsonb; position integer; accepted_language text;
  question_count integer;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select exists(select 1 from public.schools_staff where user_id=actor) into founder;
  if operation='institution' then
    if not founder then raise exception 'Founder access required' using errcode='42501'; end if;
    insert into public.schools_institutions(name,country,language) values(payload->>'name',payload->>'country',payload->>'language')
      returning to_jsonb(schools_institutions.*) into result;
    return result;
  end if;
  institution=(payload->>'institutionId')::uuid;
  cohort=(payload->>'cohortId')::uuid;
  if cohort is not null then select institution_id into institution from public.schools_cohorts where id=cohort; end if;
  select exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor
    and role='institution_admin' and accepted_at is not null) into administrator;
  select exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
    on m.institution_id=institution and m.user_id=e.educator_user_id and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=actor) into adviser;
  if operation='approve' then
    if not founder or nullif(trim(payload->>'dpaReference'),'') is null then raise exception 'Founder approval and DPA reference required' using errcode='42501'; end if;
    update public.schools_institutions set dpa_reference=payload->>'dpaReference',dpa_complete=true,setup_complete=true,approved_by=actor,approved_at=now()
      where id=institution returning to_jsonb(schools_institutions.*) into result;
  elsif operation='staff' then
    if not ((founder and payload->>'role'='institution_admin') or (administrator and payload->>'role'='educator'))
    then raise exception 'Institution access required' using errcode='42501'; end if;
    insert into public.schools_institution_members(institution_id,user_id,role,accepted_at)
      values(institution,(payload->>'userId')::uuid,payload->>'role',now()) returning to_jsonb(schools_institution_members.*) into result;
  elsif operation='cohort' then
    if not administrator then raise exception 'Institution admin access required' using errcode='42501'; end if;
    insert into public.schools_cohorts(institution_id,name,enrolment_code,created_by,campus,faculty,programme)
      values(
        institution,
        payload->>'name',
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
        actor,
        nullif(trim(payload->>'campus'),''),
        nullif(trim(payload->>'faculty'),''),
        nullif(trim(payload->>'programme'),'')
      )
      returning to_jsonb(schools_cohorts.*) into result;
  elsif operation='assign_educator' then
    if not administrator or not exists(select 1 from public.schools_institution_members where institution_id=institution
      and user_id=(payload->>'userId')::uuid and role='educator' and accepted_at is not null)
    then raise exception 'Accepted institution educator required' using errcode='42501'; end if;
    insert into public.schools_cohort_educators(cohort_id,educator_user_id) values(cohort,(payload->>'userId')::uuid)
      on conflict do nothing;
    result=jsonb_build_object('cohortId',cohort);
  elsif operation='enrolment' then
    if not (administrator or adviser) then raise exception 'Cohort access required' using errcode='42501'; end if;
    if (payload->>'open')::boolean and not exists(select 1 from public.schools_institutions where id=institution and setup_complete and dpa_complete)
    then raise exception 'Institution setup must be complete' using errcode='23514'; end if;
    update public.schools_cohorts set enrolment_open=(payload->>'open')::boolean,
      enrolment_code=case when (payload->>'rotate')::boolean then upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) else enrolment_code end
      where id=cohort and archived_at is null returning to_jsonb(schools_cohorts.*) into result;
  elsif operation='question' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    select language into accepted_language from public.schools_institutions where id=institution;
    insert into public.schools_question_versions(institution_id,question_key,version,role_id,language,question_text,rubric,no_example_follow_up,approved_by)
      values(institution,gen_random_uuid()::text,1,payload->>'roleId',accepted_language,payload->>'text',payload->'rubric',payload->>'followUp',actor)
      returning to_jsonb(schools_question_versions.*) into result;
  elsif operation='assignment' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    question_count=jsonb_array_length(payload->'questionIds');
    if question_count not between 3 and 8 then raise exception 'Approve between three and eight questions' using errcode='23514'; end if;
    insert into public.schools_assignments(
      cohort_id,role_id,due_at,created_by,industry,job_title,job_description,competencies,max_attempts
    )
    values(
      cohort,
      payload->>'roleId',
      (payload->>'dueAt')::timestamptz,
      actor,
      nullif(trim(payload->>'industry'),''),
      nullif(trim(payload->>'jobTitle'),''),
      nullif(trim(payload->>'jobDescription'),''),
      coalesce(payload->'competencies','[]'::jsonb),
      (payload->>'maxAttempts')::integer
    ) returning id into created;
    position=0;
    for item in select value from jsonb_array_elements(payload->'questionIds') loop
      insert into public.schools_assignment_questions(assignment_id,question_index,question_version_id) values(created,position,(item#>>'{}')::uuid);
      position=position+1;
    end loop;
    update public.schools_assignments set published_at=now() where id=created returning to_jsonb(schools_assignments.*) into result;
  else raise exception 'Unknown operation' using errcode='23514';
  end if;
  if result is null then raise exception 'Record unavailable' using errcode='42501'; end if;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,operation,'schools_management',coalesce(created,cohort,institution),institution);
  return result;
end;
$$;

commit;
