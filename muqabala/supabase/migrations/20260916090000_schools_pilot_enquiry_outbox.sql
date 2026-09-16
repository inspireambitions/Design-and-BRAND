begin;

alter table schools_private.pilot_contacts
  add column submission_id uuid unique,
  add column status text not null default 'new' check (status in ('new','replied','closed')),
  add column owner_name text not null default 'Muqabala Schools team' check (owner_name='Muqabala Schools team'),
  add column owner_email text not null default 'hello@trymuqabala.com' check (owner_email='hello@trymuqabala.com'),
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid;
create index schools_pilot_inbox_order on schools_private.pilot_contacts ((status='new') desc,created_at desc,id desc);

-- Prospective enquiries have no institution. Keep their mail separate and let
-- the existing 90-day contact retention cascade to the payloads and receipts.
create table schools_private.pilot_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references schools_private.pilot_contacts(id) on delete cascade,
  kind text not null check (kind in ('acknowledgement','internal')),
  recipient text not null,
  sender text not null default 'Muqabala Schools <hello@auth.trymuqabala.com>'
    check (sender='Muqabala Schools <hello@auth.trymuqabala.com>'),
  reply_to text not null default 'hello@trymuqabala.com' check (reply_to='hello@trymuqabala.com'),
  subject text not null,
  body_text text not null,
  body_html text not null,
  status text not null default 'queued' check (status in ('queued','sending','accepted','failed')),
  attempts integer not null default 0 check (attempts>=0),
  claim_id uuid, claim_expires_at timestamptz, first_attempted_at timestamptz,
  next_at timestamptz not null default now(),
  provider_message_id text, accepted_at timestamptz,
  failure_code text check (failure_code in ('provider_retryable','provider_permanent','attempts_exhausted','retry_window_expired')),
  created_at timestamptz not null default now(),
  unique(contact_id,kind),
  check (kind<>'internal' or recipient='hello@trymuqabala.com')
);
create index schools_pilot_mail_ready on schools_private.pilot_mail_outbox(next_at,created_at)
  where status in ('queued','sending');
alter table schools_private.pilot_mail_outbox enable row level security;
revoke all on schools_private.pilot_mail_outbox from public,anon,authenticated;
grant all on schools_private.pilot_mail_outbox to service_role;

create function public.schools_submit_pilot_contact(
  institution_name text,person_name text,contact_email text,contact_message text,
  submission_id uuid default null,mail_available boolean default true
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare enquiry schools_private.pilot_contacts; inserted uuid; ack text; notice text;
begin
  institution_name=btrim(institution_name); person_name=btrim(person_name);
  contact_email=btrim(contact_email); contact_message=btrim(contact_message);
  if institution_name is null or length(institution_name) not between 1 and 160
    or person_name is null or length(person_name) not between 1 and 100
    or contact_message is null or length(contact_message) not between 1 and 2000
    or contact_email is null or length(contact_email)>254
    or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then raise exception 'Invalid enquiry' using errcode='23514'; end if;

  -- The unique index serializes competing inserts. A replay locks the committed
  -- row and compares every field; no upsert ever replaces the original content.
  insert into schools_private.pilot_contacts(institution,contact_name,email,message,submission_id)
    values(institution_name,person_name,contact_email,contact_message,submission_id)
    on conflict on constraint pilot_contacts_submission_id_key do nothing returning id into inserted;
  if inserted is null then
    select * into enquiry from schools_private.pilot_contacts p
      where p.submission_id=schools_submit_pilot_contact.submission_id for update;
    if enquiry.id is null then raise exception 'Retry enquiry transaction' using errcode='40001'; end if;
    if row(enquiry.institution,enquiry.contact_name,enquiry.email,enquiry.message)
      is distinct from row(institution_name,person_name,contact_email,contact_message)
    then raise exception 'Submission ID already used for a different enquiry' using errcode='23505'; end if;
  else
    select * into enquiry from schools_private.pilot_contacts where id=inserted;
    ack=E'Thank you for contacting Muqabala for Schools and Colleges. Your pilot enquiry has been saved.\n\nReference: '
      ||enquiry.id||E'\n\nYour reply owner is the Muqabala Schools team at hello@trymuqabala.com. Reply to this email with any follow-up and include your reference.\n\nThis acknowledges your enquiry; it does not confirm a pilot place or a response time.';
    notice=E'A new Schools and Colleges pilot enquiry is ready for review.\n\nReference: '||enquiry.id
      ||E'\n\nOpen the founder inbox: https://trymuqabala.com/schools/founder\n\nReply owner: Muqabala Schools team <hello@trymuqabala.com>. Sign in with founder access to read the enquiry and record its status.';
    -- Immutable payloads keep retries identical even across application deploys.
    -- Neither email copies the free-text enquiry or subscribes anyone to marketing.
    insert into schools_private.pilot_mail_outbox(contact_id,kind,recipient,subject,body_text,body_html) values
      (enquiry.id,'acknowledgement',enquiry.email,'Your Muqabala Schools pilot enquiry',ack,
        '<div style="white-space:pre-wrap">'||ack||'</div>'),
      (enquiry.id,'internal','hello@trymuqabala.com','New Muqabala Schools pilot enquiry',notice,
        '<div style="white-space:pre-wrap">'||replace(replace(notice,'<','&lt;'),'>','&gt;')||'</div>');
  end if;
  return jsonb_build_object('reference',enquiry.id,'acknowledgement',case when coalesce(mail_available,false)
    and exists(select 1 from schools_private.pilot_mail_outbox m where m.contact_id=enquiry.id and m.kind='acknowledgement'
      and (m.status='accepted' or (m.status in ('queued','sending')
        and (m.first_attempted_at is null or m.first_attempted_at>now()-interval '23 hours')
        and not (m.attempts>=5 and (m.status='queued' or m.claim_expires_at<=now())))))
    then 'queued' else 'unavailable' end);
end;
$$;

-- Preserve the original four-argument RPC, including its UUID result. Only new
-- calls queue mail; existing enquiries are deliberately not backfilled.
create or replace function public.schools_pilot_contact(institution_name text,person_name text,contact_email text,contact_message text)
returns uuid language sql security invoker set search_path='' as $$
  select (public.schools_submit_pilot_contact(institution_name,person_name,contact_email,contact_message)->>'reference')::uuid;
$$;

create function public.schools_claim_pilot_mail(claim uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;
begin
  if claim is null then raise exception 'Claim required' using errcode='23514'; end if;
  update schools_private.pilot_mail_outbox set status='failed',claim_id=null,claim_expires_at=null,
    failure_code=case when first_attempted_at<=now()-interval '23 hours' then 'retry_window_expired' else 'attempts_exhausted' end
    where (status='queued' or (status='sending' and claim_expires_at<=now()))
      and (attempts>=5 or first_attempted_at<=now()-interval '23 hours');
  with ready as (
    select id from schools_private.pilot_mail_outbox where attempts<5 and next_at<=now()
      and (first_attempted_at is null or first_attempted_at>now()-interval '23 hours')
      and (status='queued' or (status='sending' and claim_expires_at<=now()))
    order by created_at,id limit 2 for update skip locked
  ), claimed as (
    update schools_private.pilot_mail_outbox m set status='sending',attempts=attempts+1,
      claim_id=claim,claim_expires_at=now()+interval '2 minutes',first_attempted_at=coalesce(first_attempted_at,now())
      from ready where m.id=ready.id returning m.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into jobs from claimed;
  return jobs;
end;
$$;

create function public.schools_finish_pilot_mail(message uuid,claim uuid,provider_id text,permanent_failure boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare item schools_private.pilot_mail_outbox;
begin
  select * into item from schools_private.pilot_mail_outbox where id=message and claim_id=claim
    and status='sending' and claim_expires_at>now() for update;
  if item.id is null then return false; end if;
  if provider_id is not null and length(btrim(provider_id))=0 then raise exception 'Invalid receipt' using errcode='23514'; end if;
  update schools_private.pilot_mail_outbox set
    status=case when provider_id is not null then 'accepted'
      when permanent_failure or attempts>=5 or first_attempted_at<=now()-interval '23 hours' then 'failed' else 'queued' end,
    provider_message_id=provider_id,accepted_at=case when provider_id is not null then now() else null end,
    failure_code=case when provider_id is not null then null when permanent_failure then 'provider_permanent'
      when first_attempted_at<=now()-interval '23 hours' then 'retry_window_expired'
      when attempts>=5 then 'attempts_exhausted' else 'provider_retryable' end,
    next_at=now()+make_interval(secs=>60*power(2,least(attempts,5))::integer),claim_id=null,claim_expires_at=null
    where id=item.id;
  return true;
end;
$$;

create function public.schools_pilot_inbox_page(actor uuid,page_size integer default 25,page_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  if page_size is null or page_size not between 1 and 100 or page_offset is null or page_offset<0
    then raise exception 'Invalid pagination' using errcode='23514'; end if;
  with page as (
    select p.* from schools_private.pilot_contacts p order by (status='new') desc,created_at desc,id desc limit page_size offset page_offset
  ), items as (
    select p.*,coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'kind',m.kind,'status',case when expired.yes then 'failed' else m.status end,
      'attempts',m.attempts,'providerMessageId',m.provider_message_id,'canRetry',(m.status='failed' or expired.yes)
        and (m.first_attempted_at is null or m.first_attempted_at>now()-interval '23 hours'),
      'failureCode',case when expired.yes then case when m.first_attempted_at<=now()-interval '23 hours'
        then 'retry_window_expired' else 'attempts_exhausted' end else m.failure_code end
      ) order by m.kind) from schools_private.pilot_mail_outbox m
      cross join lateral (select coalesce((m.status='queued' or (m.status='sending' and m.claim_expires_at<=now()))
        and (m.attempts>=5 or m.first_attempted_at<=now()-interval '23 hours'),false) as yes) expired
      where m.contact_id=p.id),'[]'::jsonb) as mail from page p
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(items) order by (status='new') desc,created_at desc,id desc) from items),'[]'::jsonb),
    'total',count(*),'nextOffset',case when count(*)>page_offset::bigint+page_size then page_offset::bigint+page_size else null end)
    into result from schools_private.pilot_contacts;
  return result;
end;
$$;

create function public.schools_update_pilot_contact(actor uuid,contact uuid,new_status text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  if new_status is null or new_status not in ('new','replied','closed') then raise exception 'Invalid enquiry status' using errcode='23514'; end if;
  update schools_private.pilot_contacts set status=new_status,updated_at=now(),updated_by=actor where id=contact;
  return found;
end;
$$;

create function public.schools_retry_pilot_mail(actor uuid,message uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.schools_staff where user_id=actor) then raise exception 'Founder access required' using errcode='42501'; end if;
  update schools_private.pilot_mail_outbox set status='queued',attempts=0,next_at=now(),claim_id=null,claim_expires_at=null,failure_code=null
    where id=message and (first_attempted_at is null or first_attempted_at>now()-interval '23 hours')
      and (status='failed' or (attempts>=5 and (status='queued' or (status='sending' and claim_expires_at<=now()))));
  if not found then raise exception 'Inspect provider delivery records before reissuing this message' using errcode='23514'; end if;
  return true;
end;
$$;

revoke all on function public.schools_submit_pilot_contact(text,text,text,text,uuid,boolean),
  public.schools_claim_pilot_mail(uuid),public.schools_finish_pilot_mail(uuid,uuid,text,boolean),
  public.schools_pilot_inbox_page(uuid,integer,integer),public.schools_update_pilot_contact(uuid,uuid,text),public.schools_retry_pilot_mail(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.schools_submit_pilot_contact(text,text,text,text,uuid,boolean),
  public.schools_claim_pilot_mail(uuid),public.schools_finish_pilot_mail(uuid,uuid,text,boolean),
  public.schools_pilot_inbox_page(uuid,integer,integer),public.schools_update_pilot_contact(uuid,uuid,text),public.schools_retry_pilot_mail(uuid,uuid)
  to service_role;
commit;
