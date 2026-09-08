begin;
create table schools_private.staff_invites (
  id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.schools_institutions(id),
  issuer_id uuid not null references auth.users(id),role text not null check(role in ('institution_admin','educator')),
  email_hash text not null check(email_hash ~ '^[a-f0-9]{64}$'),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz,accepted_user_id uuid
);
create table schools_private.mail_outbox (
  id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.schools_institutions(id),
  recipient_user_id uuid,kind text not null check(kind in ('staff','assignment','privacy')),
  payload_id uuid not null,encrypted_message text,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
  attempts integer not null default 0,claim_id uuid,claim_expires_at timestamptz,next_at timestamptz not null default now(),
  provider_message_id text,sent_at timestamptz,created_at timestamptz not null default now(),
  unique(kind,payload_id,recipient_user_id),check(kind<>'staff' or encrypted_message is not null or status='sent')
);
create unique index schools_staff_mail_unique on schools_private.mail_outbox(payload_id) where kind='staff';
alter table schools_private.staff_invites enable row level security;
alter table schools_private.mail_outbox enable row level security;
revoke all on schools_private.staff_invites,schools_private.mail_outbox from public,anon,authenticated;
grant all on schools_private.staff_invites,schools_private.mail_outbox to service_role;
create function public.schools_invite_staff(actor uuid,institution uuid,staff_role text,recipient_hash text,secret_hash text,sealed_message text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare invite uuid;
begin
  if not ((staff_role='institution_admin' and exists(select 1 from public.schools_staff where user_id=actor))
    or (staff_role='educator' and exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor and role='institution_admin' and accepted_at is not null)))
  then raise exception 'Institution invitation access required' using errcode='42501'; end if;
  if sealed_message is null or length(sealed_message)>12000 then raise exception 'Encrypted invitation required' using errcode='23514'; end if;
  perform 1 from public.schools_institutions where id=institution for update;
  delete from schools_private.mail_outbox where kind='staff' and status<>'sent' and payload_id in (
    select id from schools_private.staff_invites where institution_id=institution and email_hash=recipient_hash and role=staff_role and accepted_at is null);
  update schools_private.staff_invites set expires_at=now() where institution_id=institution and email_hash=recipient_hash and role=staff_role and accepted_at is null;
  insert into schools_private.staff_invites(institution_id,issuer_id,role,email_hash,token_hash)
    values(institution,actor,staff_role,recipient_hash,secret_hash) returning id into invite;
  insert into schools_private.mail_outbox(institution_id,kind,payload_id,encrypted_message) values(institution,'staff',invite,sealed_message);
  return invite;
end;
$$;
create function public.schools_accept_staff(actor uuid,verified_email_hash text,secret_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare invite schools_private.staff_invites;
begin
  select * into invite from schools_private.staff_invites where token_hash=secret_hash and email_hash=verified_email_hash
    and accepted_at is null and expires_at>now() for update;
  if invite.id is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if not ((invite.role='institution_admin' and exists(select 1 from public.schools_staff where user_id=invite.issuer_id))
    or (invite.role='educator' and exists(select 1 from public.schools_institution_members where institution_id=invite.institution_id and user_id=invite.issuer_id and role='institution_admin' and accepted_at is not null)))
  then raise exception 'Inviting administrator no longer has access' using errcode='42501'; end if;
  -- Acceptance cannot silently change an existing institution role.
  if exists(select 1 from public.schools_institution_members where institution_id=invite.institution_id and user_id=actor and role<>invite.role)
  then raise exception 'Existing institution role must be reviewed' using errcode='42501'; end if;
  insert into public.schools_institution_members(institution_id,user_id,role,accepted_at) values(invite.institution_id,actor,invite.role,now())
    on conflict(institution_id,user_id) do update set accepted_at=coalesce(schools_institution_members.accepted_at,now());
  update schools_private.staff_invites set accepted_at=now(),accepted_user_id=actor where id=invite.id;
  return true;
end;
$$;
create function schools_private.assignment_mail() returns trigger language plpgsql security invoker set search_path='' as $$
declare institution uuid;
begin
  if new.published_at is not null and old.published_at is null then
    select institution_id into institution from public.schools_cohorts where id=new.cohort_id;
    insert into schools_private.mail_outbox(institution_id,recipient_user_id,kind,payload_id)
      select institution,m.student_user_id,'assignment',new.id from public.schools_cohort_members m
      where m.cohort_id=new.cohort_id and m.status='active' and not exists(select 1 from schools_private.identities where user_id=m.student_user_id)
      on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger schools_assignment_mail after update on public.schools_assignments for each row execute function schools_private.assignment_mail();
create function schools_private.enrolled_assignment_mail() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='active' and not exists(select 1 from schools_private.identities where user_id=new.student_user_id) then
    insert into schools_private.mail_outbox(institution_id,recipient_user_id,kind,payload_id)
      select c.institution_id,new.student_user_id,'assignment',a.id from public.schools_assignments a join public.schools_cohorts c on c.id=a.cohort_id
      where a.cohort_id=new.cohort_id and a.published_at is not null and a.due_at>now() on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger schools_enrolled_mail after insert on public.schools_cohort_members for each row execute function schools_private.enrolled_assignment_mail();
create function schools_private.privacy_mail() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.local_deleted_at is not null and old.local_deleted_at is null then
    insert into schools_private.mail_outbox(institution_id,recipient_user_id,kind,payload_id)
      select m.institution_id,m.user_id,'privacy',new.id from public.schools_institution_members m
      where m.institution_id=any(new.institutions) and m.role='institution_admin' and m.accepted_at is not null on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger schools_privacy_mail after update on schools_private.privacy_jobs for each row execute function schools_private.privacy_mail();
create function schools_private.remove_student_mail() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  delete from schools_private.mail_outbox where recipient_user_id=old.student_user_id and kind='assignment'
    and payload_id in (select id from public.schools_assignments where cohort_id=old.cohort_id);
  return old;
end;
$$;
create trigger schools_remove_student_mail before delete on public.schools_cohort_members for each row execute function schools_private.remove_student_mail();
create function public.schools_claim_mail(claim uuid) returns jsonb language sql security invoker set search_path='' as $$
  with ready as (select id from schools_private.mail_outbox where attempts<5 and next_at<=now()
    and (status='queued' or (status='sending' and claim_expires_at<now())) order by created_at limit 3 for update skip locked),
  claimed as (update schools_private.mail_outbox m set status='sending',attempts=attempts+1,claim_id=claim,claim_expires_at=now()+interval '2 minutes'
    from ready where m.id=ready.id returning m.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create function public.schools_finish_mail(message uuid,claim uuid,provider_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare item schools_private.mail_outbox;
begin
  select * into item from schools_private.mail_outbox where id=message and claim_id=claim and status='sending' for update;
  if item.id is null then return false; end if;
  update schools_private.mail_outbox set status=case when provider_id is not null then 'sent' when attempts>=5 then 'failed' else 'queued' end,
    sent_at=case when provider_id is not null then now() else null end,provider_message_id=provider_id,
    encrypted_message=case when provider_id is not null then null else encrypted_message end,
    next_at=now()+make_interval(secs=>60*power(2,attempts)::integer),claim_id=null,claim_expires_at=null where id=item.id;
  if item.kind='privacy' and provider_id is not null and not exists(select 1 from schools_private.mail_outbox where kind='privacy' and payload_id=item.payload_id and status<>'sent') then
    update schools_private.privacy_jobs set institution_notified_at=now() where id=item.payload_id;
  end if;
  return true;
end;
$$;
revoke all on function schools_private.assignment_mail(),schools_private.enrolled_assignment_mail(),schools_private.privacy_mail(),schools_private.remove_student_mail() from public,anon,authenticated;
revoke all on function public.schools_invite_staff(uuid,uuid,text,text,text,text),public.schools_accept_staff(uuid,text,text),public.schools_claim_mail(uuid),public.schools_finish_mail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.schools_invite_staff(uuid,uuid,text,text,text,text),public.schools_accept_staff(uuid,text,text),public.schools_claim_mail(uuid),public.schools_finish_mail(uuid,uuid,text) to service_role;
commit;
