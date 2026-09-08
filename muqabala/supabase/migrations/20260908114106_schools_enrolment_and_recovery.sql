begin;
create table schools_private.identities (
  user_id uuid primary key references auth.users(id),
  recovery_hash text unique check(recovery_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create table schools_private.access_grants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.schools_cohorts(id),
  issuer_id uuid not null references auth.users(id),
  purpose text not null check(purpose in ('enrolment','recovery')),
  mode text not null check(mode in ('email','pseudonymous')),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  email_hash text check(email_hash ~ '^[a-f0-9]{64}$'),
  student_user_id uuid references auth.users(id),
  display_name text not null check(length(trim(display_name)) between 1 and 100),
  expires_at timestamptz not null default now()+interval '7 days',
  used_at timestamptz,
  revoked_at timestamptz,
  claim_id uuid,
  claim_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check((mode='email')=(email_hash is not null)),
  check(purpose<>'recovery' or (mode='pseudonymous' and student_user_id is not null))
);
alter table schools_private.identities enable row level security;
alter table schools_private.access_grants enable row level security;
revoke all on schools_private.identities,schools_private.access_grants from public,anon,authenticated;
grant all on schools_private.identities,schools_private.access_grants to service_role;

create function public.schools_issue_access(actor uuid,cohort uuid,purpose text,mode text,secret_hash text,
  recipient_hash text,student uuid,student_name text,identity_checked boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare institution uuid; result schools_private.access_grants;
begin
  select c.institution_id into institution from public.schools_cohorts c join public.schools_institutions i on i.id=c.institution_id
    where c.id=cohort and c.archived_at is null and i.setup_complete and i.dpa_complete
      and (purpose='recovery' or c.enrolment_open) for update of c;
  if institution is null or not exists(select 1 from public.schools_cohort_educators e
    join public.schools_institution_members m on m.user_id=e.educator_user_id and m.institution_id=institution
      and m.role='educator' and m.accepted_at is not null where e.cohort_id=cohort and e.educator_user_id=actor)
  then raise exception 'Assigned adviser and completed institution setup required' using errcode='42501'; end if;
  if purpose='recovery' then
    if not coalesce(identity_checked,false) or not exists(select 1 from public.schools_cohort_members m
      join schools_private.identities i on i.user_id=m.student_user_id where m.cohort_id=cohort and m.student_user_id=student and m.status='active')
    then raise exception 'Confirm the enrolled student identity first' using errcode='42501'; end if;
    update schools_private.access_grants g set revoked_at=now() where g.student_user_id=student and g.purpose='recovery' and g.used_at is null;
  elsif student is not null then raise exception 'An enrolment grant cannot select an existing account' using errcode='23514'; end if;
  insert into schools_private.access_grants(cohort_id,issuer_id,purpose,mode,token_hash,email_hash,student_user_id,display_name,expires_at)
    values(cohort,actor,purpose,mode,secret_hash,recipient_hash,student,student_name,
      now()+case when purpose='recovery' then interval '1 day' else interval '7 days' end) returning * into result;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,case when purpose='recovery' then 'recovery_authorised' else 'enrolment_link_issued' end,'schools_access_grants',result.id,institution);
  return jsonb_build_object('id',result.id,'expiresAt',result.expires_at);
end;
$$;
create function public.schools_bind_pseudonym(actor uuid,grant_id uuid,student uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare item schools_private.access_grants;
begin
  select * into item from schools_private.access_grants where id=grant_id and issuer_id=actor and mode='pseudonymous'
    and purpose='enrolment' and used_at is null and revoked_at is null and expires_at>now() for update;
  if item.id is null or (item.student_user_id is not null and item.student_user_id<>student)
  then raise exception 'Grant unavailable' using errcode='42501'; end if;
  insert into schools_private.identities(user_id) values(student) on conflict do nothing;
  update schools_private.access_grants set student_user_id=student where id=item.id;
  return true;
end;
$$;
-- A lease serialises credential exchange without keeping a transaction open during Auth calls.
create function public.schools_claim_access(secret_hash text,claim uuid,recovery boolean,verified_email_hash text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item schools_private.access_grants; student uuid; cohort uuid;
begin
  if recovery then
    select i.user_id into student from schools_private.identities i where i.recovery_hash=secret_hash for update;
    if student is null then raise exception 'Access code unavailable' using errcode='42501'; end if;
    select m.cohort_id into cohort from public.schools_cohort_members m join public.schools_cohorts c on c.id=m.cohort_id
      join public.schools_institutions i on i.id=c.institution_id where m.student_user_id=student and m.status='active'
      and c.archived_at is null and i.setup_complete and i.dpa_complete order by m.joined_at limit 1;
    if cohort is null then raise exception 'Access code unavailable' using errcode='42501'; end if;
    -- The recovery secret itself is consumed only on successful completion.
    select * into item from schools_private.access_grants where token_hash=secret_hash for update;
    if item.id is null then
      insert into schools_private.access_grants(cohort_id,issuer_id,purpose,mode,token_hash,student_user_id,display_name,expires_at)
        values(cohort,student,'recovery','pseudonymous',secret_hash,student,'Student',now()+interval '1 day') returning * into item;
    elsif item.used_at is null and item.revoked_at is null and item.expires_at<=now() then
      update schools_private.access_grants set expires_at=now()+interval '1 day',claim_id=null,claim_expires_at=null
        where id=item.id returning * into item;
    end if;
  else
    select * into item from schools_private.access_grants where token_hash=secret_hash for update;
  end if;
  if item.id is null or item.used_at is not null or item.revoked_at is not null or item.expires_at<=now()
    or (item.claim_expires_at>now() and item.claim_id is distinct from claim)
    or (item.mode='pseudonymous' and item.student_user_id is null)
    or not exists(select 1 from public.schools_cohorts c join public.schools_institutions i on i.id=c.institution_id
      where c.id=item.cohort_id and c.archived_at is null and i.setup_complete and i.dpa_complete
      and (item.purpose='recovery' or c.enrolment_open))
    or (item.purpose='recovery' and not exists(select 1 from public.schools_cohort_members
      where cohort_id=item.cohort_id and student_user_id=item.student_user_id and status='active'))
  then raise exception 'Access code unavailable' using errcode='42501'; end if;
  if item.mode='email' and item.email_hash is distinct from verified_email_hash then
    return jsonb_build_object('requiresEmail',true);
  end if;
  update schools_private.access_grants set claim_id=claim,claim_expires_at=now()+interval '2 minutes' where id=item.id;
  return jsonb_build_object('id',item.id,'mode',item.mode,'studentId',item.student_user_id,'emailHash',item.email_hash,'purpose',item.purpose);
end;
$$;
create function public.schools_complete_access(grant_id uuid,claim uuid,student uuid,verified_email_hash text,
  new_recovery_hash text,adult_confirmed boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare item schools_private.access_grants; institution uuid;
begin
  select * into item from schools_private.access_grants where id=grant_id and claim_id=claim and claim_expires_at>now()
    and used_at is null and revoked_at is null and expires_at>now() for update;
  select c.institution_id into institution from public.schools_cohorts c join public.schools_institutions i on i.id=c.institution_id
    where c.id=item.cohort_id and c.archived_at is null and i.setup_complete and i.dpa_complete
      and (item.purpose='recovery' or c.enrolment_open) for update of c;
  if item.id is null or institution is null or student is null
    or (item.mode='email' and item.email_hash is distinct from verified_email_hash)
    or (item.mode='pseudonymous' and item.student_user_id is distinct from student)
    or (item.purpose='enrolment' and not coalesce(adult_confirmed,false))
  then raise exception 'Access could not be completed' using errcode='42501'; end if;
  if not (item.purpose='recovery' and item.issuer_id=student) and not exists(
    select 1 from public.schools_cohort_educators e join public.schools_institution_members m
      on m.user_id=e.educator_user_id and m.institution_id=institution and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=item.cohort_id and e.educator_user_id=item.issuer_id
  ) then raise exception 'Inviting adviser no longer has access' using errcode='42501'; end if;
  if item.purpose='enrolment' then
    if exists(select 1 from public.schools_cohort_members where cohort_id=item.cohort_id and student_user_id=student and status='removed')
    then raise exception 'Membership was removed' using errcode='42501'; end if;
    insert into public.schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at)
      values(item.cohort_id,student,item.display_name,now()) on conflict(cohort_id,student_user_id) do nothing;
  elsif not exists(select 1 from public.schools_cohort_members where cohort_id=item.cohort_id and student_user_id=student and status='active')
  then raise exception 'Membership was removed' using errcode='42501'; end if;
  if item.mode='pseudonymous' then
    if new_recovery_hash is null then raise exception 'Recovery code required' using errcode='23514'; end if;
    update schools_private.identities set recovery_hash=new_recovery_hash where user_id=student;
    if not found then raise exception 'Dedicated identity required' using errcode='42501'; end if;
    update public.schools_sessions set revoked_at=now() where user_id=student and revoked_at is null;
    update schools_private.access_grants set revoked_at=now() where student_user_id=student and purpose='recovery' and id<>item.id and used_at is null;
  end if;
  update schools_private.access_grants set used_at=now(),student_user_id=student,claim_id=null,claim_expires_at=null where id=item.id;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(student,case when item.purpose='recovery' then 'account_recovered' else 'student_enrolled' end,'schools_access_grants',item.id,institution);
  return true;
end;
$$;
revoke all on function public.schools_issue_access(uuid,uuid,text,text,text,text,uuid,text,boolean),
  public.schools_bind_pseudonym(uuid,uuid,uuid),public.schools_claim_access(text,uuid,boolean,text),
  public.schools_complete_access(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.schools_issue_access(uuid,uuid,text,text,text,text,uuid,text,boolean),
  public.schools_bind_pseudonym(uuid,uuid,uuid),public.schools_claim_access(text,uuid,boolean,text),
  public.schools_complete_access(uuid,uuid,uuid,text,text,boolean) to service_role;
commit;
