-- Educator Suite ADAPTIVE_V2: Canonical Assignment + Adaptive Universal Interview Architecture
-- Safe, additive, backward-compatible schema extension for institutional employability.
begin;

-- 1. Add delivery_mode to schools_assignments with safe default 'form_v1'
alter table public.schools_assignments
  add column if not exists delivery_mode text not null default 'form_v1'
  check (delivery_mode in ('form_v1', 'adaptive_v2'));

create index if not exists schools_assignments_delivery_mode_idx
  on public.schools_assignments(cohort_id, delivery_mode, status);

-- 2. Add delivery_mode, universal_interview_id, engine_version, snapshots, and evidence provenance to attempts
alter table public.schools_assignment_attempts
  add column if not exists delivery_mode text not null default 'form_v1'
  check (delivery_mode in ('form_v1', 'adaptive_v2')),
  add column if not exists universal_interview_id uuid
    references public.universal_interviews(id) on delete set null,
  add column if not exists engine_version text,
  add column if not exists canonical_questions_snapshot jsonb
    default '[]'::jsonb check (jsonb_typeof(canonical_questions_snapshot) = 'array'),
  add column if not exists adaptive_turns jsonb
    default '[]'::jsonb check (jsonb_typeof(adaptive_turns) = 'array'),
  add column if not exists evidence_ledger jsonb
    default '[]'::jsonb check (jsonb_typeof(evidence_ledger) = 'array'),
  add column if not exists evidence_sources jsonb
    default '[]'::jsonb check (jsonb_typeof(evidence_sources) = 'array');

create index if not exists schools_attempts_universal_interview_idx
  on public.schools_assignment_attempts(universal_interview_id)
  where universal_interview_id is not null;

-- 3. Relax answers check for schools_assignment_attempts while ensuring answers is an array
alter table public.schools_assignment_attempts
  drop constraint if exists schools_assignment_attempts_answers_check;

alter table public.schools_assignment_attempts
  add constraint schools_assignment_attempts_answers_check
  check (jsonb_typeof(answers) = 'array');

-- 4. Update schools_manage to accept deliveryMode when creating/duplicating assignments
create or replace function public.schools_manage(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  institution uuid; cohort uuid; prog uuid; asgn uuid;
  founder boolean; administrator boolean; adviser boolean;
  result jsonb; created uuid; item jsonb; position integer; accepted_language text;
  question_count integer; has_attempts boolean; existing_asgn record;
  target_status text; target_delivery_mode text;
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
    where id=cohort and archived_at is null returning to_jsonb(schools_cohorts.*) into result;

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
    target_delivery_mode=coalesce(nullif(trim(payload->>'deliveryMode'),''), 'form_v1');
    if target_delivery_mode not in ('form_v1','adaptive_v2') then raise exception 'Invalid delivery mode' using errcode='23514'; end if;

    insert into public.schools_assignments(
      cohort_id,role_id,due_at,created_by,industry,job_title,job_description,competencies,max_attempts,instructions,status,published_at,delivery_mode
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
      null,
      target_delivery_mode
    ) returning id into created;

    position=0;
    for item in select value from jsonb_array_elements(payload->'questionIds') loop
      insert into public.schools_assignment_questions(assignment_id,question_index,question_version_id) values(created,position,(item#>>'{}')::uuid);
      position=position+1;
    end loop;

    if target_status='published' then
      update public.schools_assignments set published_at=now() where id=created;
    end if;

    select to_jsonb(schools_assignments.*) into result from public.schools_assignments where id=created;

  elsif operation='edit_assignment' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    select * into existing_asgn from public.schools_assignments where id=asgn and cohort_id=cohort;
    if existing_asgn.id is null then raise exception 'Assignment not found' using errcode='42501'; end if;

    select exists(select 1 from public.schools_assignment_attempts where assignment_id=asgn) into has_attempts;

    if has_attempts then
      -- IMMUTABILITY GUARD: Assessment content cannot be modified once attempts exist
      if (payload ? 'questionIds')
         or (payload ? 'roleId' and payload->>'roleId' is distinct from existing_asgn.role_id)
         or (payload ? 'industry' and payload->>'industry' is distinct from existing_asgn.industry)
         or (payload ? 'competencies' and payload->'competencies' is distinct from existing_asgn.competencies)
         or (payload ? 'maxAttempts' and (payload->>'maxAttempts')::integer is distinct from existing_asgn.max_attempts)
         or (payload ? 'deliveryMode' and payload->>'deliveryMode' is distinct from existing_asgn.delivery_mode)
      then
        raise exception 'Assessment content cannot be modified after student attempts have started. Use duplicate assignment instead.' using errcode='23514';
      end if;

      update public.schools_assignments set
        due_at=coalesce((payload->>'dueAt')::timestamptz, due_at),
        instructions=case when payload ? 'instructions' then nullif(trim(payload->>'instructions'),'') else instructions end,
        status=coalesce(nullif(trim(payload->>'status'),''), status),
        published_at=case when existing_asgn.published_at is null and payload->>'status'='published' then now() else published_at end
      where id=asgn returning to_jsonb(schools_assignments.*) into result;
    else
      target_delivery_mode=coalesce(nullif(trim(payload->>'deliveryMode'),''), existing_asgn.delivery_mode);
      if target_delivery_mode not in ('form_v1','adaptive_v2') then raise exception 'Invalid delivery mode' using errcode='23514'; end if;

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
        delivery_mode=target_delivery_mode,
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

    target_delivery_mode=coalesce(nullif(trim(payload->>'deliveryMode'),''), existing_asgn.delivery_mode);

    insert into public.schools_assignments(
      cohort_id, role_id, due_at, created_by, industry, job_title, job_description, competencies,
      max_attempts, instructions, status, version, duplicated_from_id, delivery_mode
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
      existing_asgn.id,
      target_delivery_mode
    ) returning id into created;

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
