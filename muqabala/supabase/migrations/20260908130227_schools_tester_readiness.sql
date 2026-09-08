begin;
-- The Auth deletion transaction holds the user row lock. Foreign-key inserts
-- cannot slip between this guard and deletion as they can across HTTP calls.
create function schools_private.guard_auth_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from schools_private.privacy_jobs where user_id=old.id and dedicated_identity and completed_at is null)
    and (not public.schools_can_delete_auth(old.id) or exists(select 1 from public.schools_institution_members where user_id=old.id)
      or exists(select 1 from public.schools_staff where user_id=old.id)
      or exists(select 1 from public.schools_cohort_members where student_user_id=old.id))
  then raise exception 'This identity still belongs to another account context' using errcode='23503'; end if;
  return old;
end;
$$;
revoke all on function schools_private.guard_auth_deletion() from public,anon,authenticated,service_role;
create trigger schools_guard_auth_deletion before delete on auth.users for each row execute function schools_private.guard_auth_deletion();

create table schools_private.privacy_receipts (
  job_id uuid primary key references schools_private.privacy_jobs(id),
  supplier_reference text not null check(length(supplier_reference) between 1 and 500),
  notification_reference text check(length(notification_reference) between 1 and 500),
  verified_by uuid not null references auth.users(id),verified_at timestamptz not null default now()
);
alter table schools_private.privacy_receipts enable row level security;
revoke all on schools_private.privacy_receipts from public,anon,authenticated;
grant all on schools_private.privacy_receipts to service_role;

create function public.schools_finish_privacy(actor uuid,job uuid,supplier_reference text,notification_reference text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare item schools_private.privacy_jobs;
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  select * into item from schools_private.privacy_jobs where id=job for update;
  if item.id is null or item.local_deleted_at is null or (item.dedicated_identity and item.auth_deleted_at is null)
    or (item.institution_notified_at is null and nullif(trim(notification_reference),'') is null)
    or nullif(trim(supplier_reference),'') is null then raise exception 'Deletion evidence is incomplete' using errcode='23514'; end if;
  insert into schools_private.privacy_receipts(job_id,supplier_reference,notification_reference,verified_by)
    values(job,trim(supplier_reference),nullif(trim(notification_reference),''),actor)
    on conflict(job_id) do nothing;
  update schools_private.privacy_jobs set supplier_verified_at=coalesce(supplier_verified_at,now()),
    institution_notified_at=coalesce(institution_notified_at,now()),completed_at=coalesce(completed_at,now()) where id=job;
  return true;
end;
$$;

create function public.schools_update_institution(actor uuid,institution uuid,new_name text,new_country text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor and role='institution_admin' and accepted_at is not null)
    then raise exception 'Institution administration required' using errcode='42501'; end if;
  if length(trim(new_name)) not between 1 and 160 or length(trim(new_country)) not between 2 and 80 then raise exception 'Check institution details' using errcode='23514'; end if;
  update public.schools_institutions set name=trim(new_name),country=trim(new_country) where id=institution;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id) values(actor,'institution_details_updated','schools_institutions',institution,institution);
  return true;
end;
$$;
revoke all on function public.schools_finish_privacy(uuid,uuid,text,text),public.schools_update_institution(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.schools_finish_privacy(uuid,uuid,text,text),public.schools_update_institution(uuid,uuid,text,text) to service_role;
commit;
