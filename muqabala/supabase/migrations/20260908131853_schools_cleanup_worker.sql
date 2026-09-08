begin;
-- Only the service worker can resolve internal Auth addresses. This helper is
-- outside the Data API schema and does not expose Auth records to a caller.
create function schools_private.queue_orphan_identities() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; total integer=0;
begin
  for item in select g.id,g.cohort_id,c.institution_id,u.id as user_id from schools_private.access_grants g
    join public.schools_cohorts c on c.id=g.cohort_id join auth.users u on lower(u.email)='schools-'||g.id::text||'@accounts.trymuqabala.invalid'
    where g.mode='pseudonymous' and g.purpose='enrolment' and g.used_at is null
      and (g.expires_at<now() or g.revoked_at is not null)
      and not exists(select 1 from public.schools_cohort_members where student_user_id=u.id)
      and not exists(select 1 from schools_private.privacy_jobs where user_id=u.id and completed_at is null)
    limit 50 for update of g skip locked
  loop
    insert into schools_private.identities(user_id) values(item.user_id) on conflict do nothing;
    update schools_private.access_grants set student_user_id=item.user_id where id=item.id;
    insert into schools_private.privacy_jobs(user_id,institutions,reason,dedicated_identity)
      values(item.user_id,array[item.institution_id],'retention',true);
    total=total+1;
  end loop;
  return total;
end;
$$;
revoke all on function schools_private.queue_orphan_identities() from public,anon,authenticated;
grant execute on function schools_private.queue_orphan_identities() to service_role;
create function public.schools_cleanup_operations() returns integer
language plpgsql security invoker set search_path='' as $$
declare queued integer;
begin
  queued=schools_private.queue_orphan_identities();
  delete from schools_private.mail_outbox where kind='staff' and payload_id in(select id from schools_private.staff_invites where expires_at<now());
  delete from schools_private.staff_invites where expires_at<now()-interval '30 days';
  delete from public.schools_audit_log where target_table='schools_access_grants' and target_id in(select id from schools_private.access_grants where expires_at<now()-interval '30 days');
  delete from schools_private.access_grants where expires_at<now()-interval '30 days';
  delete from public.schools_sessions where last_seen_at<now()-interval '30 days';
  delete from schools_private.review_sessions where opened_at<now()-interval '1 day';
  delete from schools_private.mail_outbox where status='sent' and sent_at<now()-interval '90 days';
  return queued;
end;
$$;
create function public.schools_failed_mail(actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'createdAt',created_at,'canRetry',created_at>now()-interval '23 hours')),'[]'::jsonb)
    from schools_private.mail_outbox where status='failed');
end;
$$;
create function public.schools_retry_mail(actor uuid,message uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  update schools_private.mail_outbox set status='queued',attempts=0,next_at=now() where id=message and status='failed' and created_at>now()-interval '23 hours';
  if not found then raise exception 'Inspect provider delivery records before reissuing this message' using errcode='23514'; end if;
  return true;
end;
$$;
revoke all on function public.schools_cleanup_operations(),public.schools_failed_mail(uuid),public.schools_retry_mail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.schools_cleanup_operations(),public.schools_failed_mail(uuid),public.schools_retry_mail(uuid,uuid) to service_role;
commit;
