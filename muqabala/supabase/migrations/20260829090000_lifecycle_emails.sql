create extension if not exists pg_net with schema extensions;

create table public.lifecycle_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  marketing_opt_in boolean not null default false,
  consent_version text,
  consent_copy text,
  consent_source text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  suppressed_at timestamptz,
  suppression_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lifecycle_email_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('onboarding_2h', 'career_tools_24h')),
  locale text not null check (locale in ('en', 'ar')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','delivered','failed','cancelled','bounced','complained','suppressed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz not null,
  lease_until timestamptz,
  resend_email_id text unique,
  sent_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email_type)
);

create table public.lifecycle_email_webhook_events (
  id text primary key,
  event_type text not null,
  provider_email_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text
);

create index lifecycle_email_jobs_due_idx on public.lifecycle_email_jobs (next_attempt_at, due_at)
where status in ('pending', 'processing');
create index lifecycle_email_webhook_pending_idx on public.lifecycle_email_webhook_events (provider_email_id)
where processed_at is null;

alter table public.lifecycle_email_preferences enable row level security;
alter table public.lifecycle_email_jobs enable row level security;
alter table public.lifecycle_email_webhook_events enable row level security;
revoke all on public.lifecycle_email_preferences from anon, authenticated;
revoke all on public.lifecycle_email_jobs from anon, authenticated;
revoke all on public.lifecycle_email_webhook_events from anon, authenticated;

create function public.set_lifecycle_email_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger lifecycle_email_preferences_set_updated_at before update on public.lifecycle_email_preferences
for each row execute function public.set_lifecycle_email_updated_at();
create trigger lifecycle_email_jobs_set_updated_at before update on public.lifecycle_email_jobs
for each row execute function public.set_lifecycle_email_updated_at();

create function public.queue_muqabala_onboarding_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare selected_locale text;
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  selected_locale := case when new.raw_user_meta_data ->> 'muqabala_language' = 'ar' then 'ar' else 'en' end;
  insert into public.lifecycle_email_preferences (user_id, locale) values (new.id, selected_locale)
  on conflict (user_id) do update set locale = excluded.locale;
  insert into public.lifecycle_email_jobs (user_id,email_type,locale,due_at,next_attempt_at)
  values (new.id,'onboarding_2h',selected_locale,new.email_confirmed_at+interval '2 hours',new.email_confirmed_at+interval '2 hours')
  on conflict (user_id,email_type) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_muqabala_onboarding_email() from public, anon, authenticated;
create trigger muqabala_queue_onboarding_after_insert after insert on auth.users
for each row execute function public.queue_muqabala_onboarding_email();
create trigger muqabala_queue_onboarding_after_confirmation after update of email_confirmed_at on auth.users
for each row execute function public.queue_muqabala_onboarding_email();

create function public.claim_lifecycle_email_jobs(p_limit integer default 4)
returns table (id uuid,user_id uuid,email_type text,locale text,attempt_count integer)
language sql security definer set search_path = '' as $$
  with exhausted as (
    update public.lifecycle_email_jobs set status='failed',lease_until=null,last_error_code='attempt_limit_reached'
    where status='processing' and lease_until<=now() and attempt_count>=5
    returning id
  ), claimable as (
    select jobs.id from public.lifecycle_email_jobs jobs
    where jobs.due_at<=now() and ((jobs.status='pending' and jobs.next_attempt_at<=now()) or (jobs.status='processing' and jobs.lease_until<=now()))
      and jobs.attempt_count<5
    order by jobs.due_at,jobs.created_at for update skip locked
    limit greatest(1,least(coalesce(p_limit,4),10))
  )
  update public.lifecycle_email_jobs jobs set status='processing',attempt_count=jobs.attempt_count+1,
    lease_until=now()+interval '5 minutes',updated_at=now()
  from claimable where jobs.id=claimable.id
  returning jobs.id,jobs.user_id,jobs.email_type,jobs.locale,jobs.attempt_count;
$$;
revoke all on function public.claim_lifecycle_email_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_lifecycle_email_jobs(integer) to service_role;

create function public.lifecycle_email_send_allowed(p_job_id uuid) returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.lifecycle_email_jobs jobs
    left join public.lifecycle_email_preferences preferences on preferences.user_id=jobs.user_id
    where jobs.id=p_job_id and jobs.status='processing' and jobs.lease_until>now() and (
      jobs.email_type='onboarding_2h' or (
        jobs.email_type='career_tools_24h' and preferences.marketing_opt_in=true
        and preferences.unsubscribed_at is null and preferences.suppressed_at is null
      )
    )
  );
$$;
revoke all on function public.lifecycle_email_send_allowed(uuid) from public, anon, authenticated;
grant execute on function public.lifecycle_email_send_allowed(uuid) to service_role;

create function public.apply_lifecycle_email_event(p_email_id text,p_event_type text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare job_row public.lifecycle_email_jobs%rowtype; next_status text; now_at timestamptz:=now();
begin
  select * into job_row from public.lifecycle_email_jobs where resend_email_id=p_email_id for update;
  if not found then return false; end if;
  next_status:=case p_event_type when 'email.sent' then 'sent' when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.suppressed' then 'suppressed' when 'email.failed' then 'failed' else null end;
  if next_status is null then return true; end if;
  if job_row.status in ('complained','bounced','suppressed','cancelled','failed') then return true; end if;
  if job_row.status='delivered' and next_status in ('sent','failed') then return true; end if;
  update public.lifecycle_email_jobs set status=next_status,
    delivered_at=case when next_status='delivered' then now_at else delivered_at end,
    last_error_code=case when next_status in ('bounced','complained','suppressed','failed') then next_status else last_error_code end
  where id=job_row.id;
  if next_status in ('bounced','complained','suppressed') then
    update public.lifecycle_email_preferences set suppressed_at=now_at,suppression_reason=next_status where user_id=job_row.user_id;
    update public.lifecycle_email_jobs set status='cancelled',cancelled_at=now_at,lease_until=null,last_error_code=next_status
      where user_id=job_row.user_id and email_type='career_tools_24h' and status='pending';
  end if;
  return true;
end;
$$;
revoke all on function public.apply_lifecycle_email_event(text,text) from public, anon, authenticated;

create function public.record_lifecycle_email_event(p_id text,p_event_type text,p_email_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare matched boolean;
begin
  insert into public.lifecycle_email_webhook_events(id,event_type,provider_email_id) values(p_id,p_event_type,p_email_id) on conflict(id) do nothing;
  if not found then return 'duplicate'; end if;
  matched:=public.apply_lifecycle_email_event(p_email_id,p_event_type);
  if matched then update public.lifecycle_email_webhook_events set processed_at=now() where id=p_id; end if;
  return case when matched then 'matched' else 'pending' end;
end;
$$;
revoke all on function public.record_lifecycle_email_event(text,text,text) from public, anon, authenticated;
grant execute on function public.record_lifecycle_email_event(text,text,text) to service_role;

create function public.reconcile_lifecycle_email_events(p_email_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare event_row record;
begin
  for event_row in select id,event_type from public.lifecycle_email_webhook_events where provider_email_id=p_email_id and processed_at is null order by received_at loop
    if public.apply_lifecycle_email_event(p_email_id,event_row.event_type) then
      update public.lifecycle_email_webhook_events set processed_at=now(),last_error_code=null where id=event_row.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.reconcile_lifecycle_email_events(text) from public, anon, authenticated;
grant execute on function public.reconcile_lifecycle_email_events(text) to service_role;

create function public.reconcile_pending_lifecycle_email_events(p_limit integer default 50) returns integer
language plpgsql security definer set search_path = '' as $$
declare event_row record; processed_count integer:=0;
begin
  for event_row in select id,event_type,provider_email_id from public.lifecycle_email_webhook_events
    where processed_at is null and provider_email_id is not null order by received_at
    limit greatest(1,least(coalesce(p_limit,50),200))
  loop
    if public.apply_lifecycle_email_event(event_row.provider_email_id,event_row.event_type) then
      update public.lifecycle_email_webhook_events set processed_at=now(),last_error_code=null where id=event_row.id;
      processed_count:=processed_count+1;
    end if;
  end loop;
  return processed_count;
end;
$$;
revoke all on function public.reconcile_pending_lifecycle_email_events(integer) from public, anon, authenticated;
grant execute on function public.reconcile_pending_lifecycle_email_events(integer) to service_role;

-- Activate the five-minute cron only after the deployed worker and both Vault secrets are verified.
