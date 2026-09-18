-- FORM_V1 retries must respect the assignment's max_attempts, as the adaptive
-- path already does (lib/schools/adaptive-adapter.ts). Before this change
-- schools_retry created a new draft attempt without any limit, so a student
-- could exceed the "Allowed Attempts" the educator set.
create or replace function public.schools_retry(actor uuid,source_attempt uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.schools_assignment_attempts; a public.schools_assignments; draft public.schools_assignment_attempts; used integer;
begin
  select * into t from public.schools_assignment_attempts where id=source_attempt and student_user_id=actor and status='submitted';
  select * into a from public.schools_assignments where id=t.assignment_id for update;
  if actor is null or t.id is null or a.due_at<=now() or not exists(select 1 from public.schools_cohort_members m
    join public.schools_cohorts c on c.id=m.cohort_id join public.schools_institutions i on i.id=c.institution_id
    where m.cohort_id=a.cohort_id and m.student_user_id=actor and m.status='active'
    and c.archived_at is null and i.setup_complete and i.dpa_complete)
  then raise exception 'Retry is unavailable' using errcode='42501'; end if;
  select * into draft from public.schools_assignment_attempts where assignment_id=a.id and student_user_id=actor and status='draft';
  if draft.id is null then
    select count(*) into used from public.schools_assignment_attempts where assignment_id=a.id and student_user_id=actor;
    if a.max_attempts is not null and used>=a.max_attempts then
      raise exception 'You have used all your attempts for this assignment' using errcode='42501';
    end if;
    insert into public.schools_assignment_attempts(assignment_id,student_user_id,attempt_number,answers,copied_from_attempt_id)
      select a.id,actor,max(attempt_number)+1,t.answers,t.id from public.schools_assignment_attempts
      where assignment_id=a.id and student_user_id=actor returning * into draft;
  end if;
  return to_jsonb(draft);
end;
$$;
