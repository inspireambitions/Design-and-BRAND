begin;
alter table public.schools_assignment_attempts add column feedback_failure_code text;
create function public.schools_failed_feedback(actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'failure',feedback_failure_code,'tries',feedback_tries)),'[]'::jsonb)
    from public.schools_assignment_attempts where feedback_status='failed');
end;
$$;
create function public.schools_retry_feedback(actor uuid,attempt uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  update public.schools_assignment_attempts set feedback_status='pending',feedback_tries=0,feedback_claim=null,feedback_failure_code=null
    where id=attempt and feedback_status='failed' and status='submitted' and feedback_started_at<now()-interval '1 minute';
  if not found then raise exception 'Feedback is not ready for a controlled retry' using errcode='23514'; end if;
  return true;
end;
$$;
revoke all on function public.schools_failed_feedback(uuid),public.schools_retry_feedback(uuid,uuid) from public,anon,authenticated;
grant execute on function public.schools_failed_feedback(uuid),public.schools_retry_feedback(uuid,uuid) to service_role;
commit;
