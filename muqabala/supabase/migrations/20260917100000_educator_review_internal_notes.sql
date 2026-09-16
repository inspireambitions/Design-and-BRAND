-- Add additive internal_notes column for educator/adviser-only deliberation
alter table public.schools_reviews
  add column if not exists internal_notes text check(char_length(internal_notes) <= 1000);

-- Update public.schools_write to handle internal_notes atomically while preserving undo and revision semantics
create or replace function public.schools_write(actor uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  a public.schools_assignments;
  c public.schools_cohorts;
  t public.schools_assignment_attempts;
  r public.schools_reviews;
  previous jsonb;
  result jsonb;
  is_adviser boolean;
  answer jsonb;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if operation in ('draft','submit') then
    select * into a from public.schools_assignments where id=(payload->>'assignmentId')::uuid for update;
    select * into c from public.schools_cohorts where id=a.cohort_id;
    if a.id is null or a.published_at is null or c.archived_at is not null or a.opens_at>now() or a.due_at<=now()
      or not exists(select 1 from public.schools_cohort_members where cohort_id=a.cohort_id and student_user_id=actor and status='active')
      or not exists(select 1 from public.schools_institutions where id=c.institution_id and setup_complete and dpa_complete)
    then raise exception 'Assignment is unavailable' using errcode='42501'; end if;
    if jsonb_typeof(payload->'answers') is distinct from 'array' or jsonb_array_length(payload->'answers')<>3
    then raise exception 'Three answers are required' using errcode='23514'; end if;
    for answer in select value from jsonb_array_elements(payload->'answers') loop
      if jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>12000
        or (operation='submit' and length(trim(answer#>>'{}'))=0)
      then raise exception 'Check your answer text' using errcode='23514'; end if;
    end loop;
    if (select count(*) from public.schools_assignment_questions where assignment_id=a.id)<>3
    then raise exception 'Assignment questions are incomplete' using errcode='23514'; end if;
    select * into t from public.schools_assignment_attempts
      where id=(payload->>'attemptId')::uuid and assignment_id=a.id and student_user_id=actor for update;
    if t.id is not null and t.answers=payload->'answers'
      and ((operation='submit' and t.status='submitted') or (operation='draft' and t.status='draft'))
    then return to_jsonb(t); end if;
    select * into t from public.schools_assignment_attempts
      where assignment_id=a.id and student_user_id=actor and status='draft' for update;
    if t.id is null then
      if coalesce((payload->>'revision')::int,0)<>0 then
        select * into t from public.schools_assignment_attempts where id=(payload->>'attemptId')::uuid
          and assignment_id=a.id and student_user_id=actor and status='submitted';
        if operation='submit' and t.id is not null and t.answers=payload->'answers' then return to_jsonb(t); end if;
        raise exception 'This answer changed in another window' using errcode='40001';
      end if;
      insert into public.schools_assignment_attempts(id,assignment_id,student_user_id,attempt_number,answers)
        select coalesce((payload->>'attemptId')::uuid,gen_random_uuid()),a.id,actor,coalesce(max(attempt_number),0)+1,payload->'answers'
        from public.schools_assignment_attempts where assignment_id=a.id and student_user_id=actor returning * into t;
    elsif t.revision<>coalesce((payload->>'revision')::int,-1)
      or t.id is distinct from (payload->>'attemptId')::uuid then
      raise exception 'This answer changed in another window' using errcode='40001';
    end if;
    update public.schools_assignment_attempts set answers=payload->'answers',revision=revision+1,updated_at=now(),
      status=case when operation='submit' then 'submitted' else 'draft' end,
      submitted_at=case when operation='submit' then now() else null end
      where id=t.id returning * into t;
    update public.schools_cohort_members set last_activity_at=now() where cohort_id=c.id and student_user_id=actor;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
      values(actor,case when operation='submit' then 'attempt_submitted' else 'attempt_saved' end,'schools_assignment_attempts',t.id,c.institution_id);
    return to_jsonb(t);
  elsif operation in ('review','undo_review') then
    select * into t from public.schools_assignment_attempts where id=(payload->>'attemptId')::uuid for update;
    select * into a from public.schools_assignments where id=t.assignment_id;
    select * into c from public.schools_cohorts where id=a.cohort_id;
    select exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
      on m.user_id=e.educator_user_id and m.institution_id=c.institution_id
      where e.cohort_id=c.id and e.educator_user_id=actor and m.role='educator' and m.accepted_at is not null) into is_adviser;
    if t.id is null or t.status<>'submitted' or not is_adviser
    then raise exception 'Submitted attempt is unavailable' using errcode='42501'; end if;
    select * into r from public.schools_reviews where assignment_attempt_id=t.id for update;
    if r.id is not null and r.educator_id<>actor then raise exception 'Another adviser owns this review' using errcode='42501'; end if;
    if coalesce(r.revision,0)<>coalesce((payload->>'revision')::int,-1)
    then raise exception 'Review changed in another window' using errcode='40001'; end if;
    if operation='undo_review' then
      if r.id is null or r.undo_expires_at is null or r.undo_expires_at<clock_timestamp()
      then raise exception 'Undo has expired' using errcode='23514'; end if;
      previous=r.previous_review_snapshot;
      if previous is null then
        delete from public.schools_reviews where id=r.id;
        result='null'::jsonb;
      else
        update public.schools_reviews set state=previous->>'state',comment=previous->>'comment',
          internal_notes=previous->>'internal_notes',
          created_at=(previous->>'created_at')::timestamptz,updated_at=(previous->>'updated_at')::timestamptz,
          previous_review_snapshot=null,undo_expires_at=null,revision=r.revision+1 where id=r.id returning to_jsonb(schools_reviews.*) into result;
      end if;
    else
      if payload->>'state' not in ('on_track','needs_more','discuss') or payload->>'state' is null
        or length(coalesce(payload->>'comment',''))>280
        or length(coalesce(payload->>'internalNotes',''))>1000 then raise exception 'Check the review' using errcode='23514'; end if;
      previous=case when r.id is null then null else to_jsonb(r) end;
      insert into public.schools_reviews(assignment_attempt_id,educator_id,state,comment,internal_notes,previous_review_snapshot,undo_expires_at)
        values(t.id,actor,payload->>'state',coalesce(payload->>'comment',''),payload->>'internalNotes',previous,clock_timestamp()+interval '10 seconds')
        on conflict(assignment_attempt_id) do update set state=excluded.state,comment=excluded.comment,
          internal_notes=excluded.internal_notes,
          previous_review_snapshot=excluded.previous_review_snapshot,undo_expires_at=excluded.undo_expires_at,
          revision=schools_reviews.revision+1,updated_at=now() returning to_jsonb(schools_reviews.*) into result;
    end if;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
      values(actor,case when operation='review' then 'review_saved' else 'review_undone' end,'schools_assignment_attempts',t.id,c.institution_id);
    return result;
  elsif operation='support' then
    select * into c from public.schools_cohorts where id=(payload->>'cohortId')::uuid for update;
    if c.id is null or not exists(select 1 from public.schools_cohort_members
      where cohort_id=c.id and student_user_id=actor and status='active')
    then raise exception 'Cohort unavailable' using errcode='42501'; end if;
    select to_jsonb(s.*) into result from public.schools_support_requests s
      where cohort_id=c.id and student_user_id=actor and status<>'closed' order by created_at limit 1;
    if result is null then
      insert into public.schools_support_requests(cohort_id,student_user_id,created_by)
        values(c.id,actor,'student') returning to_jsonb(schools_support_requests.*) into result;
      insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
        values(actor,'support_requested','schools_support_requests',(result->>'id')::uuid,c.institution_id);
    end if;
    return result;
  end if;
  raise exception 'Unknown schools operation' using errcode='23514';
end;
$$;
