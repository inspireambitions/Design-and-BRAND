begin;
create table schools_private.events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.schools_institutions(id),
  cohort_id uuid references public.schools_cohorts(id),
  event text not null check(event in ('institution_setup_complete','educator_assigned','student_enrolled','assignment_created','attempt_saved','attempt_submitted','feedback_opened','retry_started','no_example_prompt_used','review_saved','evidence_corrected','support_requested','deletion_requested')),
  role text not null check(role in ('founder_admin','institution_admin','educator','student')),
  device text not null check(device in ('mobile','tablet','desktop','server')),
  review_state text check(review_state in ('on_track','needs_more','discuss')),
  duration_seconds integer check(duration_seconds between 0 and 3600),
  created_at timestamptz not null default now()
);
create table schools_private.review_sessions (
  attempt_id uuid not null references public.schools_assignment_attempts(id) on delete cascade,
  educator_id uuid not null references auth.users(id),opened_at timestamptz not null default now(),primary key(attempt_id,educator_id)
);
alter table schools_private.events enable row level security;
alter table schools_private.review_sessions enable row level security;
revoke all on schools_private.events,schools_private.review_sessions from public,anon,authenticated;
grant all on schools_private.events,schools_private.review_sessions to service_role;

create function schools_private.audit_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare event_name text; cohort uuid; actor_role text; device_name text; review_state text; elapsed integer;
begin
  event_name=case new.action when 'approve' then 'institution_setup_complete' when 'assign_educator' then 'educator_assigned'
    when 'assignment' then 'assignment_created' else new.action end;
  if event_name not in ('institution_setup_complete','educator_assigned','student_enrolled','assignment_created','attempt_saved','attempt_submitted','feedback_opened','retry_started','review_saved','evidence_corrected','support_requested') then return new; end if;
  if new.target_table='schools_assignment_attempts' then
    select a.cohort_id into cohort from public.schools_assignment_attempts t join public.schools_assignments a on a.id=t.assignment_id where t.id=new.target_id;
  elsif new.target_table='schools_support_requests' then select cohort_id into cohort from public.schools_support_requests where id=new.target_id;
  elsif new.target_table='schools_access_grants' then select cohort_id into cohort from schools_private.access_grants where id=new.target_id;
  elsif event_name='assignment_created' then select cohort_id into cohort from public.schools_assignments where id=new.target_id;
  elsif event_name='educator_assigned' then cohort=new.target_id;
  end if;
  actor_role=case when exists(select 1 from public.schools_staff where user_id=new.actor_user_id) then 'founder_admin'
    else coalesce((select role from public.schools_institution_members where institution_id=new.institution_id and user_id=new.actor_user_id),'student') end;
  device_name=coalesce(nullif(current_setting('schools.device',true),''),'server');
  if device_name not in ('mobile','tablet','desktop','server') then device_name='server'; end if;
  if event_name='review_saved' then
    select state into review_state from public.schools_reviews where assignment_attempt_id=new.target_id;
    select extract(epoch from clock_timestamp()-opened_at)::int into elapsed from schools_private.review_sessions where attempt_id=new.target_id and educator_id=new.actor_user_id;
    if elapsed not between 0 and 3600 then elapsed=null; end if;
    delete from schools_private.review_sessions where attempt_id=new.target_id and educator_id=new.actor_user_id;
  end if;
  insert into schools_private.events(institution_id,cohort_id,event,role,device,review_state,duration_seconds)
    values(new.institution_id,cohort,event_name,actor_role,device_name,review_state,elapsed);
  return new;
end;
$$;
create trigger schools_audit_event after insert on public.schools_audit_log for each row execute function schools_private.audit_event();
revoke all on function schools_private.audit_event() from public,anon,authenticated;

create function public.schools_action(actor uuid,operation text,payload jsonb,device text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cohort uuid; institution uuid; result jsonb;
begin
  if device not in ('mobile','tablet','desktop','server') then raise exception 'Invalid device' using errcode='23514'; end if;
  perform set_config('schools.device',device,true);
  if operation='claim_support' then return to_jsonb(public.schools_claim_support(actor,(payload->>'cohortId')::uuid,(payload->>'studentId')::uuid)); end if;
  if operation='read' then return to_jsonb(public.schools_mark_read(actor,(payload->>'attemptId')::uuid,(payload->>'feedback')::boolean,(payload->>'reviewRevision')::integer));
  elsif operation='adviser_support' then return public.schools_adviser_support(actor,(payload->>'cohortId')::uuid,(payload->>'studentId')::uuid,payload->>'status',payload->>'note');
  elsif operation='retry' then return public.schools_retry(actor,(payload->>'attemptId')::uuid);
  elsif operation='correct' then
    perform 1 from public.schools_assignment_attempts where id=(payload->>'attemptId')::uuid for update;
    if (payload->>'revision')::integer is distinct from (select count(*)::integer from public.schools_evidence_corrections where assignment_attempt_id=(payload->>'attemptId')::uuid)
    then raise exception 'Evidence changed. Reload before correcting.' using errcode='40001'; end if;
    return public.schools_correct_evidence(actor,(payload->>'attemptId')::uuid,(payload->>'question')::integer,payload->>'element',(payload->>'present')::boolean,payload->>'reason');
  elsif operation='review_open' then
    select a.cohort_id,c.institution_id into cohort,institution from public.schools_assignment_attempts t
      join public.schools_assignments a on a.id=t.assignment_id join public.schools_cohorts c on c.id=a.cohort_id
      join public.schools_cohort_educators e on e.cohort_id=c.id and e.educator_user_id=actor
      join public.schools_institution_members m on m.institution_id=c.institution_id and m.user_id=actor and m.role='educator' and m.accepted_at is not null
      where t.id=(payload->>'attemptId')::uuid and t.status='submitted';
    if cohort is null then raise exception 'Assigned adviser required' using errcode='42501'; end if;
    insert into schools_private.review_sessions(attempt_id,educator_id) values((payload->>'attemptId')::uuid,actor)
      on conflict(attempt_id,educator_id) do update set opened_at=now();
    return 'true'::jsonb;
  elsif operation='no_example' then
    select c.id,c.institution_id into cohort,institution from public.schools_cohorts c join public.schools_cohort_members m
      on m.cohort_id=c.id and m.student_user_id=actor and m.status='active' where c.id=(payload->>'cohortId')::uuid;
    if cohort is null then raise exception 'Student membership required' using errcode='42501'; end if;
    insert into schools_private.events(institution_id,cohort_id,event,role,device) values(institution,cohort,'no_example_prompt_used','student',device);
    return 'true'::jsonb;
  end if;
  return public.schools_write(actor,operation,payload);
end;
$$;
create function public.schools_manage_action(actor uuid,operation text,payload jsonb,device text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if device not in ('mobile','tablet','desktop','server') then raise exception 'Invalid device' using errcode='23514'; end if;
  perform set_config('schools.device',device,true);
  return public.schools_manage(actor,operation,payload);
end;
$$;
revoke all on function public.schools_action(uuid,text,jsonb,text),public.schools_manage_action(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.schools_action(uuid,text,jsonb,text),public.schools_manage_action(uuid,text,jsonb,text) to service_role;
create function schools_private.deletion_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare institution uuid;
begin
  if new.reason='student_request' then
    foreach institution in array new.institutions loop
      insert into schools_private.events(institution_id,event,role,device) values(institution,'deletion_requested','student','server');
    end loop;
  end if;
  return new;
end;
$$;
create trigger schools_deletion_event after insert on schools_private.privacy_jobs for each row execute function schools_private.deletion_event();
revoke all on function schools_private.deletion_event() from public,anon,authenticated;
commit;
