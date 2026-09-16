-- Educator Suite P0-B: Institutional Programmes, Assignment Lifecycle & Intervention Foundations
-- Safe, additive, backward-compatible schema extension for institutional employability.
begin;

-- 1. First-Class Institutional Programmes Table
create table if not exists public.schools_programmes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.schools_institutions(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  code text check (code is null or length(trim(code)) between 1 and 32),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  campus text check (campus is null or length(trim(campus)) between 1 and 160),
  faculty text check (faculty is null or length(trim(faculty)) between 1 and 160),
  description text check (description is null or length(trim(description)) between 1 and 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(institution_id, name)
);

create index if not exists schools_programmes_institution_idx
  on public.schools_programmes(institution_id, status);

-- 2. Link Cohorts to First-Class Programmes
alter table public.schools_cohorts
  add column if not exists programme_id uuid references public.schools_programmes(id) on delete set null;

create index if not exists schools_cohorts_programme_id_idx
  on public.schools_cohorts(programme_id)
  where programme_id is not null;

-- 3. Assignment Lifecycle, Instructions and Safe Versioning
alter table public.schools_assignments
  add column if not exists status text not null default 'published' check (status in ('draft','published','closed')),
  add column if not exists instructions text check (instructions is null or length(trim(instructions)) between 1 and 2000),
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists duplicated_from_id uuid references public.schools_assignments(id) on delete set null;

create index if not exists schools_assignments_cohort_status_idx
  on public.schools_assignments(cohort_id, status, due_at);

-- 4. Permissions & Row Level Security
alter table public.schools_programmes enable row level security;
revoke all on public.schools_programmes from public,anon,authenticated;
grant all on public.schools_programmes to service_role;

create policy schools_active_session on public.schools_programmes
  as restrictive for select to authenticated using (schools_private.session_active());

grant select on public.schools_programmes to authenticated;
grant select(campus, faculty, programme, programme_id) on public.schools_cohorts to authenticated;

create policy schools_programmes_read on public.schools_programmes
  for select to authenticated using (
    schools_private.is_founder()
    or schools_private.is_admin(institution_id)
    or schools_private.teaches_institution(institution_id)
    or exists(
      select 1 from public.schools_institution_members m
      where m.institution_id=schools_programmes.institution_id
        and m.user_id=auth.uid()
        and m.role='educator'
        and m.accepted_at is not null
    )
  );

-- 5. Extend schools_manage procedure for Programmes, Cohorts, and Assignment Lifecycle
create or replace function public.schools_manage(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  institution uuid; cohort uuid; prog uuid; asgn uuid;
  founder boolean; administrator boolean; adviser boolean;
  result jsonb; created uuid; item jsonb; position integer; accepted_language text;
  question_count integer; has_attempts boolean; existing_asgn record;
  target_status text;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select exists(select 1 from public.schools_staff where user_id=actor) into founder;

  if operation='institution' then
    if not founder then raise exception 'Founder access required' using errcode='42501'; end if;
    insert into public.schools_institutions(name,country,language) values(payload->>'name',payload->>'country',payload->>'language')
      returning to_jsonb(schools_institutions.*) into result;
    return result;
  end if;

  asgn=(payload->>'assignmentId')::uuid;
  cohort=(payload->>'cohortId')::uuid;
  prog=(payload->>'programmeId')::uuid;
  institution=(payload->>'institutionId')::uuid;

  -- Derive authoritative hierarchy from existing entities when targeted
  if asgn is not null then
    select cohort_id into cohort from public.schools_assignments where id=asgn;
    if cohort is not null then
      select institution_id into institution from public.schools_cohorts where id=cohort;
    end if;
  elsif cohort is not null then
    select institution_id into institution from public.schools_cohorts where id=cohort;
  elsif prog is not null and (operation in ('archive_programme') or institution is null) then
    select institution_id into institution from public.schools_programmes where id=prog;
  end if;

  select exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor
    and role='institution_admin' and accepted_at is not null) into administrator;

  select exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
    on m.institution_id=institution and m.user_id=e.educator_user_id and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=actor) into adviser;

  -- An educator accepted in this institution can act as institutional educator
  if not adviser and exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor and role='educator' and accepted_at is not null) then
    adviser=true;
  end if;

  if operation='approve' then
    if not founder or nullif(trim(payload->>'dpaReference'),'') is null then raise exception 'Founder approval and DPA reference required' using errcode='42501'; end if;
    update public.schools_institutions set dpa_reference=payload->>'dpaReference',dpa_complete=true,setup_complete=true,approved_by=actor,approved_at=now()
      where id=institution returning to_jsonb(schools_institutions.*) into result;

  elsif operation='staff' then
    if not ((founder and payload->>'role'='institution_admin') or (administrator and payload->>'role'='educator'))
    then raise exception 'Institution access required' using errcode='42501'; end if;
    insert into public.schools_institution_members(institution_id,user_id,role,accepted_at)
      values(institution,(payload->>'userId')::uuid,payload->>'role',now()) returning to_jsonb(schools_institution_members.*) into result;

  elsif operation='programme' then
    if not (administrator or adviser) then raise exception 'Institution educator or admin access required' using errcode='42501'; end if;
    if prog is null then
      -- Create new programme
      insert into public.schools_programmes(
        institution_id, name, code, campus, faculty, description, created_by
      )
      values(
        institution,
        payload->>'name',
        nullif(trim(payload->>'code'),''),
        nullif(trim(payload->>'campus'),''),
        nullif(trim(payload->>'faculty'),''),
        nullif(trim(payload->>'description'),''),
        actor
      )
      returning to_jsonb(schools_programmes.*) into result;
    else
      -- Update existing programme
      update public.schools_programmes set
        name=coalesce(nullif(trim(payload->>'name'),''), name),
        code=case when payload ? 'code' then nullif(trim(payload->>'code'),'') else code end,
        campus=case when payload ? 'campus' then nullif(trim(payload->>'campus'),'') else campus end,
        faculty=case when payload ? 'faculty' then nullif(trim(payload->>'faculty'),'') else faculty end,
        description=case when payload ? 'description' then nullif(trim(payload->>'description'),'') else description end,
        status=coalesce(nullif(trim(payload->>'status'),''), status),
        updated_at=now()
      where id=prog and institution_id=institution and archived_at is null
      returning to_jsonb(schools_programmes.*) into result;
    end if;

  elsif operation='archive_programme' then
    if not (administrator or adviser) then raise exception 'Institution educator or admin access required' using errcode='42501'; end if;
    update public.schools_programmes set status='archived', archived_at=now(), updated_at=now()
      where id=prog and institution_id=institution returning to_jsonb(schools_programmes.*) into result;

  elsif operation='cohort' then
    if not (administrator or adviser) then raise exception 'Institution educator or admin access required' using errcode='42501'; end if;
    if payload ? 'programmeId' and nullif(trim(payload->>'programmeId'),'') is not null then
      if not exists(select 1 from public.schools_programmes where id=(payload->>'programmeId')::uuid and institution_id=institution and archived_at is null) then
        raise exception 'Programme not found in this institution' using errcode='23503';
      end if;
    end if;
    insert into public.schools_cohorts(
      institution_id, name, enrolment_code, created_by, campus, faculty, programme, programme_id
    )
    values(
      institution,
      payload->>'name',
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      actor,
      nullif(trim(payload->>'campus'),''),
      nullif(trim(payload->>'faculty'),''),
      nullif(trim(payload->>'programme'),''),
      nullif(trim(payload->>'programmeId'),'')::uuid
    )
    returning id into created;

    -- Automatically assign creator as educator to their cohort
    insert into public.schools_cohort_educators(cohort_id, educator_user_id)
      values(created, actor) on conflict do nothing;

    select to_jsonb(schools_cohorts.*) into result from public.schools_cohorts where id=created;

  elsif operation='edit_cohort' then
    if not (administrator or adviser) then raise exception 'Cohort educator or admin access required' using errcode='42501'; end if;
    if payload ? 'programmeId' and nullif(trim(payload->>'programmeId'),'') is not null then
      if not exists(select 1 from public.schools_programmes where id=(payload->>'programmeId')::uuid and institution_id=institution and archived_at is null) then
        raise exception 'Programme not found in this institution' using errcode='23503';
      end if;
    end if;
    update public.schools_cohorts set
      name=coalesce(nullif(trim(payload->>'name'),''), name),
      campus=case when payload ? 'campus' then nullif(trim(payload->>'campus'),'') else campus end,
      faculty=case when payload ? 'faculty' then nullif(trim(payload->>'faculty'),'') else faculty end,
      programme=case when payload ? 'programme' then nullif(trim(payload->>'programme'),'') else programme end,
      programme_id=case when payload ? 'programmeId' then nullif(trim(payload->>'programmeId'),'')::uuid else programme_id end
    where id=cohort and institution_id=institution and archived_at is null
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
    target_status=coalesce(nullif(trim(payload->>'status'),''), 'published');
    if target_status not in ('draft','published','closed') then raise exception 'Invalid assignment status' using errcode='23514'; end if;

    insert into public.schools_assignments(
      cohort_id,role_id,due_at,created_by,industry,job_title,job_description,competencies,max_attempts,instructions,status,published_at
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
      (payload->>'maxAttempts')::integer,
      nullif(trim(payload->>'instructions'),''),
      target_status,
      case when target_status='published' then now() else null end
    ) returning id into created;

    position=0;
    for item in select value from jsonb_array_elements(payload->'questionIds') loop
      insert into public.schools_assignment_questions(assignment_id,question_index,question_version_id) values(created,position,(item#>>'{}')::uuid);
      position=position+1;
    end loop;

    select to_jsonb(schools_assignments.*) into result from public.schools_assignments where id=created;

  elsif operation='edit_assignment' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    select * into existing_asgn from public.schools_assignments where id=asgn and cohort_id=cohort;
    if existing_asgn.id is null then raise exception 'Assignment not found' using errcode='42501'; end if;

    select exists(select 1 from public.schools_assignment_attempts where assignment_id=asgn) into has_attempts;

    if has_attempts then
      -- IMMUTABILITY GUARD: If students have already started attempts, cannot mutate assessment configuration
      if (payload ? 'questionIds')
         or (payload ? 'roleId' and payload->>'roleId' is distinct from existing_asgn.role_id)
         or (payload ? 'industry' and payload->>'industry' is distinct from existing_asgn.industry)
         or (payload ? 'competencies' and payload->'competencies' is distinct from existing_asgn.competencies)
         or (payload ? 'maxAttempts' and (payload->>'maxAttempts')::integer is distinct from existing_asgn.max_attempts)
      then
        raise exception 'Assessment content cannot be modified after student attempts have started. Use duplicate assignment instead.' using errcode='23514';
      end if;

      -- Safe administrative metadata can be updated (dueAt, instructions, status)
      update public.schools_assignments set
        due_at=coalesce((payload->>'dueAt')::timestamptz, due_at),
        instructions=case when payload ? 'instructions' then nullif(trim(payload->>'instructions'),'') else instructions end,
        status=coalesce(nullif(trim(payload->>'status'),''), status),
        published_at=case when existing_asgn.published_at is null and payload->>'status'='published' then now() else published_at end
      where id=asgn returning to_jsonb(schools_assignments.*) into result;
    else
      -- No attempts yet: educator can freely edit all fields
      update public.schools_assignments set
        role_id=coalesce(nullif(trim(payload->>'roleId'),''), role_id),
        due_at=coalesce((payload->>'dueAt')::timestamptz, due_at),
        industry=case when payload ? 'industry' then nullif(trim(payload->>'industry'),'') else industry end,
        job_title=case when payload ? 'jobTitle' then nullif(trim(payload->>'jobTitle'),'') else job_title end,
        job_description=case when payload ? 'jobDescription' then nullif(trim(payload->>'jobDescription'),'') else job_description end,
        competencies=case when payload ? 'competencies' then payload->'competencies' else competencies end,
        max_attempts=case when payload ? 'maxAttempts' then (payload->>'maxAttempts')::integer else max_attempts end,
        instructions=case when payload ? 'instructions' then nullif(trim(payload->>'instructions'),'') else instructions end,
        status=coalesce(nullif(trim(payload->>'status'),''), status),
        published_at=case when existing_asgn.published_at is null and payload->>'status'='published' then now() else published_at end
      where id=asgn returning to_jsonb(schools_assignments.*) into result;

      if payload ? 'questionIds' then
        question_count=jsonb_array_length(payload->'questionIds');
        if question_count not between 3 and 8 then raise exception 'Approve between three and eight questions' using errcode='23514'; end if;
        delete from public.schools_assignment_questions where assignment_id=asgn;
        position=0;
        for item in select value from jsonb_array_elements(payload->'questionIds') loop
          insert into public.schools_assignment_questions(assignment_id,question_index,question_version_id) values(asgn,position,(item#>>'{}')::uuid);
          position=position+1;
        end loop;
      end if;
    end if;

  elsif operation='duplicate_assignment' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    select * into existing_asgn from public.schools_assignments where id=asgn and cohort_id=cohort;
    if existing_asgn.id is null then raise exception 'Assignment not found' using errcode='42501'; end if;

    insert into public.schools_assignments(
      cohort_id, role_id, due_at, created_by, industry, job_title, job_description, competencies,
      max_attempts, instructions, status, version, duplicated_from_id
    )
    values(
      existing_asgn.cohort_id,
      existing_asgn.role_id,
      coalesce((payload->>'dueAt')::timestamptz, existing_asgn.due_at + interval '7 days'),
      actor,
      existing_asgn.industry,
      existing_asgn.job_title,
      existing_asgn.job_description,
      existing_asgn.competencies,
      existing_asgn.max_attempts,
      existing_asgn.instructions,
      'draft',
      existing_asgn.version + 1,
      existing_asgn.id
    ) returning id into created;

    -- Duplicate existing question links
    insert into public.schools_assignment_questions(assignment_id, question_index, question_version_id)
      select created, question_index, question_version_id from public.schools_assignment_questions where assignment_id=asgn;

    select to_jsonb(schools_assignments.*) into result from public.schools_assignments where id=created;

  else raise exception 'Unknown operation' using errcode='23514';
  end if;

  if result is null then raise exception 'Record unavailable' using errcode='42501'; end if;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,operation,'schools_management',coalesce(created,asgn,prog,cohort,institution),institution);
  return result;
end;
$$;

commit;
