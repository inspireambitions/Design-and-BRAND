begin;
create table schools_private.pilot_contacts (
  id uuid primary key default gen_random_uuid(),institution text not null check(length(institution) between 1 and 160),
  contact_name text not null check(length(contact_name) between 1 and 100),email text not null check(length(email)<=254),
  message text not null check(length(message) between 1 and 2000),created_at timestamptz not null default now()
);
alter table schools_private.pilot_contacts enable row level security;
revoke all on schools_private.pilot_contacts from public,anon,authenticated;
grant all on schools_private.pilot_contacts to service_role;
create function public.schools_pilot_contact(institution_name text,person_name text,contact_email text,contact_message text) returns uuid
language sql security invoker set search_path='' as $$
  insert into schools_private.pilot_contacts(institution,contact_name,email,message)
    values(institution_name,person_name,contact_email,contact_message) returning id;
$$;
create function public.schools_pilot_inbox() returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(item)),'[]'::jsonb) from (select * from schools_private.pilot_contacts order by created_at desc limit 50) item;
$$;
revoke all on function public.schools_pilot_contact(text,text,text,text),public.schools_pilot_inbox() from public,anon,authenticated;
grant execute on function public.schools_pilot_contact(text,text,text,text),public.schools_pilot_inbox() to service_role;
create table schools_private.privacy_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  cohort_id uuid,
  institutions uuid[] not null,
  reason text not null check(reason in ('student_request','retention')),
  dedicated_identity boolean not null,
  local_deleted_at timestamptz,
  auth_deleted_at timestamptz,
  supplier_verified_at timestamptz,
  institution_notified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index schools_privacy_pending on schools_private.privacy_jobs(user_id,coalesce(cohort_id,'00000000-0000-0000-0000-000000000000'::uuid)) where completed_at is null;
alter table schools_private.privacy_jobs enable row level security;
revoke all on schools_private.privacy_jobs from public,anon,authenticated;
grant all on schools_private.privacy_jobs to service_role;

create function public.schools_request_deletion(actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare job uuid; institutions uuid[];
begin
  perform 1 from public.schools_cohort_members where student_user_id=actor for update;
  if not found then raise exception 'Student membership required' using errcode='42501'; end if;
  select id into job from schools_private.privacy_jobs where user_id=actor and cohort_id is null and completed_at is null for update;
  if job is not null then return job; end if;
  select array_agg(distinct c.institution_id) into institutions from public.schools_cohort_members m
    join public.schools_cohorts c on c.id=m.cohort_id where m.student_user_id=actor;
  insert into schools_private.privacy_jobs(user_id,institutions,reason,dedicated_identity)
    values(actor,institutions,'student_request',exists(select 1 from schools_private.identities where user_id=actor)) returning id into job;
  update public.schools_cohort_members set status='removed',removed_at=coalesce(removed_at,now()) where student_user_id=actor;
  update public.schools_sessions set revoked_at=now() where user_id=actor and revoked_at is null;
  return job;
end;
$$;
create function public.schools_queue_retention() returns integer
language plpgsql security invoker set search_path='' as $$
declare member record; total integer=0;
begin
  delete from schools_private.pilot_contacts where created_at<now()-interval '90 days';
  for member in select m.student_user_id,m.cohort_id,c.institution_id from public.schools_cohort_members m
    join public.schools_cohorts c on c.id=m.cohort_id join public.schools_institutions i on i.id=c.institution_id
    where (c.archived_at is not null and c.archived_at+make_interval(days=>i.data_retention_days_archived)<=now())
      or (c.archived_at is null and m.last_activity_at+make_interval(days=>i.data_retention_days_active)<=now())
    order by m.last_activity_at limit 100 for update of m skip locked
  loop
    if exists(select 1 from schools_private.privacy_jobs where user_id=member.student_user_id and completed_at is null
      and (cohort_id is null or cohort_id=member.cohort_id)) then continue; end if;
    insert into schools_private.privacy_jobs(user_id,cohort_id,institutions,reason,dedicated_identity)
      values(member.student_user_id,member.cohort_id,array[member.institution_id],'retention',false);
    update public.schools_cohort_members set status='removed',removed_at=coalesce(removed_at,now())
      where student_user_id=member.student_user_id and cohort_id=member.cohort_id;
    total=total+1;
  end loop;
  return total;
end;
$$;
create function public.schools_purge_local(job_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job schools_private.privacy_jobs; attempts uuid[]; targets uuid[]; institution uuid; remaining boolean;
begin
  select * into job from schools_private.privacy_jobs where id=job_id for update;
  if job.id is null then raise exception 'Deletion request unavailable' using errcode='42501'; end if;
  if job.local_deleted_at is not null then return jsonb_build_object('userId',job.user_id,'deleteAuth',job.dedicated_identity); end if;
  -- Lock memberships before attempts, matching the request and retention workers.
  perform 1 from public.schools_cohort_members where student_user_id=job.user_id and (job.cohort_id is null or cohort_id=job.cohort_id) for update;
  perform 1 from public.schools_assignment_attempts t join public.schools_assignments a on a.id=t.assignment_id
    where t.student_user_id=job.user_id and (job.cohort_id is null or a.cohort_id=job.cohort_id) for update of t;
  select coalesce(array_agg(t.id),'{}'::uuid[]) into attempts from public.schools_assignment_attempts t
    join public.schools_assignments a on a.id=t.assignment_id where t.student_user_id=job.user_id and (job.cohort_id is null or a.cohort_id=job.cohort_id);
  select coalesce(array_agg(id),'{}'::uuid[]) into targets from (
    select unnest(attempts) as id
    union all select id from public.schools_reviews where assignment_attempt_id=any(attempts)
    union all select id from public.schools_evidence_corrections where assignment_attempt_id=any(attempts)
    union all select id from public.schools_feedback_versions where assignment_attempt_id=any(attempts)
    union all select id from schools_private.access_grants where student_user_id=job.user_id and (job.cohort_id is null or cohort_id=job.cohort_id)
    union all select id from public.schools_support_requests where student_user_id=job.user_id and (job.cohort_id is null or cohort_id=job.cohort_id)
  ) identifiers;
  delete from public.schools_reviews where assignment_attempt_id=any(attempts);
  delete from public.schools_evidence_corrections where assignment_attempt_id=any(attempts);
  update public.schools_assignment_attempts set feedback_version_id=null,feedback_status='pending',copied_from_attempt_id=null where id=any(attempts);
  delete from public.schools_feedback_versions where assignment_attempt_id=any(attempts);
  delete from public.schools_assignment_attempts where id=any(attempts);
  delete from public.schools_support_requests where student_user_id=job.user_id and (job.cohort_id is null or cohort_id=job.cohort_id);
  delete from schools_private.access_grants where (student_user_id=job.user_id or issuer_id=job.user_id) and (job.cohort_id is null or cohort_id=job.cohort_id);
  delete from public.schools_cohort_members where student_user_id=job.user_id and (job.cohort_id is null or cohort_id=job.cohort_id);
  delete from public.schools_audit_log where target_id=any(targets) or (actor_user_id=job.user_id and institution_id=any(job.institutions));
  select exists(select 1 from public.schools_cohort_members where student_user_id=job.user_id) into remaining;
  if not remaining then
    job.dedicated_identity=exists(select 1 from schools_private.identities where user_id=job.user_id);
    delete from schools_private.identities where user_id=job.user_id;
    update public.schools_sessions set revoked_at=now() where user_id=job.user_id and revoked_at is null;
    delete from public.schools_audit_log where actor_user_id=job.user_id;
  end if;
  foreach institution in array job.institutions loop
    insert into public.schools_audit_log(action,target_table,institution_id)
      values('student_data_deleted','schools_privacy',institution);
  end loop;
  update schools_private.privacy_jobs set local_deleted_at=now(),dedicated_identity=job.dedicated_identity,
    user_id=case when job.dedicated_identity then user_id else null end where id=job.id;
  return jsonb_build_object('userId',job.user_id,'deleteAuth',job.dedicated_identity);
end;
$$;
create function public.schools_privacy_pending() returns jsonb
language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) from (select id,user_id,local_deleted_at,auth_deleted_at,dedicated_identity
    from schools_private.privacy_jobs where completed_at is null and (local_deleted_at is null or (dedicated_identity and auth_deleted_at is null))
    order by created_at limit 50) j;
$$;
create function public.schools_can_delete_auth(student uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare reference record; used_elsewhere boolean;
begin
  -- Preserve any later use of this identity in another product, including new tables.
  for reference in select n.nspname as schema_name,t.relname as table_name,a.attname as column_name
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=any(c.conkey)
    where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname='public' and t.relname not like 'schools\_%' escape '\'
  loop
    execute format('select exists(select 1 from %I.%I where %I=$1)',reference.schema_name,reference.table_name,reference.column_name) into used_elsewhere using student;
    if used_elsewhere then return false; end if;
  end loop;
  return true;
end;
$$;
create function public.schools_privacy_auth_done(job_id uuid,deleted boolean) returns boolean
language sql security invoker set search_path='' as $$
  update schools_private.privacy_jobs set auth_deleted_at=case when deleted then now() else null end,
    dedicated_identity=deleted,user_id=null where id=job_id and local_deleted_at is not null and dedicated_identity returning true;
$$;
revoke all on function public.schools_request_deletion(uuid),public.schools_queue_retention(),public.schools_purge_local(uuid),
  public.schools_privacy_pending(),public.schools_can_delete_auth(uuid),public.schools_privacy_auth_done(uuid,boolean) from public,anon,authenticated;
grant execute on function public.schools_request_deletion(uuid),public.schools_queue_retention(),public.schools_purge_local(uuid),
  public.schools_privacy_pending(),public.schools_can_delete_auth(uuid),public.schools_privacy_auth_done(uuid,boolean) to service_role;
commit;
