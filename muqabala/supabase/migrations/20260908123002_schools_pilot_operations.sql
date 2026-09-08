begin;
create table schools_private.feedback_usage (
  claim_id uuid primary key,institution_id uuid not null references public.schools_institutions(id),
  cohort_id uuid not null references public.schools_cohorts(id),model text not null,
  input_tokens integer check(input_tokens>=0),output_tokens integer check(output_tokens>=0),
  estimated_usd numeric(14,8) check(estimated_usd>=0),created_at timestamptz not null default now()
);
alter table schools_private.feedback_usage enable row level security;
revoke all on schools_private.feedback_usage from public,anon,authenticated;
grant all on schools_private.feedback_usage to service_role;
create function public.schools_record_usage(attempt uuid,claim uuid,model_name text,input_count integer,output_count integer,estimated_cost numeric) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  insert into schools_private.feedback_usage(claim_id,institution_id,cohort_id,model,input_tokens,output_tokens,estimated_usd)
    select claim,c.institution_id,c.id,model_name,input_count,output_count,estimated_cost from public.schools_assignment_attempts t
    join public.schools_assignments a on a.id=t.assignment_id join public.schools_cohorts c on c.id=a.cohort_id
    where t.id=attempt and t.feedback_claim=claim on conflict do nothing;
  return found;
end;
$$;
create function public.schools_pilot_metrics(actor uuid,institution uuid,period_start timestamptz,period_end timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  if period_start>=period_end then raise exception 'Invalid evaluation period' using errcode='23514'; end if;
  with enrolled as (
    select distinct m.student_user_id from public.schools_cohort_members m join public.schools_cohorts c on c.id=m.cohort_id
    where c.institution_id=institution and m.joined_at<period_end and (m.removed_at is null or m.removed_at>=period_start)
  ), attempt_sets as (
    select t.student_user_id,count(*) as attempts from public.schools_assignment_attempts t join public.schools_assignments a on a.id=t.assignment_id
    join public.schools_cohorts c on c.id=a.cohort_id where c.institution_id=institution and t.status='submitted' and t.submitted_at>=period_start and t.submitted_at<period_end
    group by t.student_user_id,t.assignment_id
  ), submissions as (
    select student_user_id,sum(attempts) as attempts,bool_or(attempts>=2) as has_retry from attempt_sets group by student_user_id
  ), reviewed as (
    select count(*)::integer as attempts from public.schools_reviews r join public.schools_assignment_attempts t on t.id=r.assignment_attempt_id
    join public.schools_assignments a on a.id=t.assignment_id join public.schools_cohorts c on c.id=a.cohort_id
    where c.institution_id=institution and r.created_at>=period_start and r.created_at<period_end
  ), corrections as (
    select count(distinct (e.assignment_attempt_id,e.question_index,e.rubric_element))::integer as elements from public.schools_evidence_corrections e
    join public.schools_assignment_attempts t on t.id=e.assignment_attempt_id join public.schools_assignments a on a.id=t.assignment_id
    join public.schools_cohorts c on c.id=a.cohort_id join public.schools_reviews r on r.assignment_attempt_id=t.id
    where c.institution_id=institution and r.created_at>=period_start and r.created_at<period_end
  ), usage as (
    select count(*)::integer as calls,count(*) filter(where estimated_usd is null)::integer as unknown_calls,sum(estimated_usd) as estimate
    from schools_private.feedback_usage where institution_id=institution and created_at>=period_start and created_at<period_end
  ) select jsonb_build_object(
    'enrolled',(select count(*) from enrolled),'submitted',(select count(*) from submissions),'retried',(select count(*) from submissions where has_retry),
    'reviewedElements',(select attempts*12 from reviewed),'correctedElements',(select elements from corrections),
    'medianReviewSeconds',(select percentile_cont(0.5) within group(order by duration_seconds) from schools_private.events
      where institution_id=institution and event='review_saved' and created_at>=period_start and created_at<period_end and duration_seconds is not null),
    'feedbackCalls',(select calls from usage),'unknownCostCalls',(select unknown_calls from usage),
    'estimatedCostUsd',(select case when unknown_calls=0 and calls>0 then estimate else null end from usage),
    'estimatedCostPerActiveLearnerUsd',(select case when unknown_calls=0 and calls>0 then estimate/nullif((select count(*) from submissions),0) else null end from usage),
    'periodStart',period_start,'periodEnd',period_end
  ) into result;
  return result;
end;
$$;
create function public.schools_operations_status(actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'mailQueued',(select count(*) from schools_private.mail_outbox where status in ('queued','sending')),
    'mailFailed',(select count(*) from schools_private.mail_outbox where status='failed'),
    'privacy',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'createdAt',created_at,'localDeletedAt',local_deleted_at,
      'supplierVerifiedAt',supplier_verified_at,'institutionNotifiedAt',institution_notified_at)),'[]'::jsonb) from schools_private.privacy_jobs where completed_at is null)
  );
end;
$$;
revoke all on function public.schools_record_usage(uuid,uuid,text,integer,integer,numeric),public.schools_pilot_metrics(uuid,uuid,timestamptz,timestamptz),public.schools_operations_status(uuid) from public,anon,authenticated;
grant execute on function public.schools_record_usage(uuid,uuid,text,integer,integer,numeric),public.schools_pilot_metrics(uuid,uuid,timestamptz,timestamptz),public.schools_operations_status(uuid) to service_role;
create function public.schools_claim_support(actor uuid,cohort uuid,student uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_cohort_educators e join public.schools_cohorts c on c.id=e.cohort_id
    join public.schools_institution_members m on m.institution_id=c.institution_id and m.user_id=actor and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=actor) then raise exception 'Assigned adviser required' using errcode='42501'; end if;
  update public.schools_support_requests set owner_educator_id=actor,updated_at=now()
    where cohort_id=cohort and student_user_id=student and status<>'closed' and owner_educator_id is null;
  return found;
end;
$$;
revoke all on function public.schools_claim_support(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.schools_claim_support(uuid,uuid,uuid) to service_role;
create or replace function public.schools_manage_action(actor uuid,operation text,payload jsonb,device text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare institution uuid; cohort uuid; allowed boolean;
begin
  if device not in ('mobile','tablet','desktop','server') then raise exception 'Invalid device' using errcode='23514'; end if;
  perform set_config('schools.device',device,true);
  if operation in ('remove_member','archive_cohort') then
    cohort=(payload->>'cohortId')::uuid;
    select institution_id into institution from public.schools_cohorts where id=cohort for update;
    select exists(select 1 from public.schools_institution_members m where m.institution_id=institution and m.user_id=actor and m.accepted_at is not null
      and (m.role='institution_admin' or (m.role='educator' and exists(select 1 from public.schools_cohort_educators e where e.cohort_id=cohort and e.educator_user_id=actor)))) into allowed;
    if not coalesce(allowed,false) then raise exception 'Cohort management access required' using errcode='42501'; end if;
    if operation='remove_member' then
      update public.schools_cohort_members set status='removed',removed_at=now() where cohort_id=cohort and student_user_id=(payload->>'studentId')::uuid and status='active';
      update schools_private.access_grants set revoked_at=now() where cohort_id=cohort and student_user_id=(payload->>'studentId')::uuid and used_at is null;
      delete from schools_private.mail_outbox where kind='assignment' and recipient_user_id=(payload->>'studentId')::uuid
        and payload_id in(select id from public.schools_assignments where cohort_id=cohort);
    else
      update public.schools_cohorts set archived_at=coalesce(archived_at,now()),enrolment_open=false where id=cohort;
      update schools_private.access_grants set revoked_at=now() where cohort_id=cohort and used_at is null;
    end if;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id) values(actor,operation,'schools_cohorts',cohort,institution);
    return 'true'::jsonb;
  end if;
  return public.schools_manage(actor,operation,payload);
end;
$$;
commit;
