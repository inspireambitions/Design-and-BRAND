begin;
alter table schools_private.mail_outbox add column first_attempted_at timestamptz;
-- Historic attempts use the earliest possible send time. A conservative hold
-- is safer than resending outside the provider's 24-hour deduplication window.
update schools_private.mail_outbox set first_attempted_at=created_at where attempts>0;
create or replace function public.schools_claim_mail(claim uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;
begin
  update schools_private.mail_outbox set status='failed',claim_id=null,claim_expires_at=null
    where (status='queued' or (status='sending' and claim_expires_at<now()))
      and (attempts>=5 or first_attempted_at<=now()-interval '23 hours');
  delete from schools_private.mail_outbox m where m.kind='assignment' and m.status<>'sent'
    and not exists(select 1 from public.schools_assignments a join public.schools_cohort_members c on c.cohort_id=a.cohort_id
      where a.id=m.payload_id and c.student_user_id=m.recipient_user_id and c.status='active' and a.due_at>now());
  with ready as (select id from schools_private.mail_outbox where attempts<5 and next_at<=now()
    and (first_attempted_at is null or first_attempted_at>now()-interval '23 hours')
    and (status='queued' or (status='sending' and claim_expires_at<now())) order by created_at limit 3 for update skip locked),
  claimed as (update schools_private.mail_outbox m set status='sending',attempts=attempts+1,claim_id=claim,
    first_attempted_at=coalesce(first_attempted_at,now()),claim_expires_at=now()+interval '2 minutes'
    from ready where m.id=ready.id returning m.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into jobs from claimed;
  return jobs;
end;
$$;
create or replace function public.schools_failed_mail(actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'createdAt',created_at,
    'canRetry',coalesce(first_attempted_at,created_at)>now()-interval '23 hours')),'[]'::jsonb)
    from schools_private.mail_outbox where status='failed');
end;
$$;
create or replace function public.schools_retry_mail(actor uuid,message uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  update schools_private.mail_outbox set status='queued',attempts=0,next_at=now()
    where id=message and status='failed' and coalesce(first_attempted_at,created_at)>now()-interval '23 hours';
  if not found then raise exception 'Inspect provider delivery records before reissuing this message' using errcode='23514'; end if;
  return true;
end;
$$;
-- Removal takes effect before a pending message is picked up. An email already
-- accepted by the supplier cannot be recalled; its link still enforces access.
create function schools_private.cancel_removed_mail() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='removed' and old.status<>'removed' then
    delete from schools_private.mail_outbox where recipient_user_id=new.student_user_id and kind='assignment' and status<>'sent'
      and payload_id in(select id from public.schools_assignments where cohort_id=new.cohort_id);
  end if;
  return new;
end;
$$;
create trigger schools_cancel_removed_mail after update of status on public.schools_cohort_members
  for each row execute function schools_private.cancel_removed_mail();
revoke all on function schools_private.cancel_removed_mail() from public,anon,authenticated;
commit;
