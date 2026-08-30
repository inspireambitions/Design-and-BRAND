create type public.practice_plan_delivery_status as enum (
  'queued', 'sending', 'sent', 'delivered', 'delayed', 'bounced',
  'complained', 'failed', 'suppressed', 'dead_letter'
);

create type public.outbox_job_state as enum (
  'pending', 'processing', 'retry', 'completed', 'dead_letter'
);

create table public.practice_plan_requests (
  id uuid primary key,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  plan_version text not null check (plan_version = '1'),
  locale text not null check (locale in ('en', 'ar')),
  client_request_id uuid not null unique,
  email_hash text not null,
  email_ciphertext text not null,
  provider_idempotency_key text not null unique,
  provider_message_id text unique,
  status public.practice_plan_delivery_status not null default 'queued',
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (interview_id, plan_version)
);

create table public.practice_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  plan_request_id uuid not null unique references public.practice_plan_requests(id) on delete cascade,
  plan_version text not null check (plan_version = '1'),
  plan_ciphertext text not null,
  plan_digest text not null,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.plan_delivery_consents (
  id uuid primary key default gen_random_uuid(),
  plan_request_id uuid not null unique references public.practice_plan_requests(id) on delete cascade,
  email_hash text not null,
  consent_version text not null check (consent_version = 'practice-plan-delivery-v1'),
  locale text not null check (locale in ('en', 'ar')),
  created_at timestamptz not null default now()
);

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  plan_request_id uuid not null references public.practice_plan_requests(id) on delete cascade,
  attempt_number smallint not null check (attempt_number between 1 and 20),
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('started', 'accepted', 'retryable_failure', 'permanent_failure')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (plan_request_id, attempt_number)
);

create table public.transactional_outbox (
  id uuid primary key default gen_random_uuid(),
  plan_request_id uuid not null references public.practice_plan_requests(id) on delete cascade,
  job_type text not null check (job_type = 'practice_plan_email_v1'),
  state public.outbox_job_state not null default 'pending',
  attempts smallint not null default 0 check (attempts between 0 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_request_id, job_type)
);

create table public.scoped_magic_link_grants (
  id uuid primary key,
  plan_request_id uuid not null unique references public.practice_plan_requests(id) on delete cascade,
  token_hash text not null unique,
  scope text not null check (scope = 'practice_plan:view'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.resend_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text,
  payload_digest text not null,
  occurred_at timestamptz,
  processed_at timestamptz not null default now()
);

create table public.email_suppressions (
  email_hash text primary key,
  reason text not null check (reason in ('hard_bounce', 'complaint', 'provider_suppressed')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_plan_requests_email_created_idx on public.practice_plan_requests (email_hash, created_at desc);
create index practice_plan_requests_expiry_idx on public.practice_plan_requests (expires_at);
create index email_delivery_attempts_created_idx on public.email_delivery_attempts (created_at);
create index transactional_outbox_ready_idx on public.transactional_outbox (state, available_at);
create index resend_webhook_provider_idx on public.resend_webhook_events (provider_message_id);

create trigger practice_plan_requests_set_updated_at
before update on public.practice_plan_requests
for each row execute function public.set_updated_at();

create trigger transactional_outbox_set_updated_at
before update on public.transactional_outbox
for each row execute function public.set_updated_at();

create trigger email_suppressions_set_updated_at
before update on public.email_suppressions
for each row execute function public.set_updated_at();

alter table public.practice_plan_requests enable row level security;
alter table public.practice_plan_snapshots enable row level security;
alter table public.plan_delivery_consents enable row level security;
alter table public.email_delivery_attempts enable row level security;
alter table public.transactional_outbox enable row level security;
alter table public.scoped_magic_link_grants enable row level security;
alter table public.resend_webhook_events enable row level security;
alter table public.email_suppressions enable row level security;

revoke all on public.practice_plan_requests from public, anon, authenticated;
revoke all on public.practice_plan_snapshots from public, anon, authenticated;
revoke all on public.plan_delivery_consents from public, anon, authenticated;
revoke all on public.email_delivery_attempts from public, anon, authenticated;
revoke all on public.transactional_outbox from public, anon, authenticated;
revoke all on public.scoped_magic_link_grants from public, anon, authenticated;
revoke all on public.resend_webhook_events from public, anon, authenticated;
revoke all on public.email_suppressions from public, anon, authenticated;

create function public.create_practice_plan_request(
  p_request_id uuid,
  p_interview_id uuid,
  p_client_request_id uuid,
  p_locale text,
  p_email_hash text,
  p_email_ciphertext text,
  p_plan_ciphertext text,
  p_plan_digest text,
  p_provider_idempotency_key text,
  p_consent_version text,
  p_grant_id uuid,
  p_grant_token_hash text,
  p_grant_expires_at timestamptz,
  p_data_expires_at timestamptz
)
returns table(result text, plan_request_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
begin
  perform 1 from public.interviews
  where id = p_interview_id and status = 'completed' and mode <> 'screening'
  for update;
  if not found then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  select id into v_existing from public.practice_plan_requests
  where interview_id = p_interview_id and plan_version = '1';
  if found then
    return query select 'already_requested'::text, v_existing;
    return;
  end if;

  if exists (
    select 1 from public.email_suppressions
    where email_hash = p_email_hash and active = true
  ) then
    return query select 'suppressed'::text, null::uuid;
    return;
  end if;

  insert into public.practice_plan_requests (
    id, interview_id, plan_version, locale, client_request_id, email_hash,
    email_ciphertext, provider_idempotency_key, expires_at
  ) values (
    p_request_id, p_interview_id, '1', p_locale, p_client_request_id, p_email_hash,
    p_email_ciphertext, p_provider_idempotency_key, p_data_expires_at
  );

  insert into public.practice_plan_snapshots (
    plan_request_id, plan_version, plan_ciphertext, plan_digest
  ) values (p_request_id, '1', p_plan_ciphertext, p_plan_digest);

  insert into public.plan_delivery_consents (plan_request_id, email_hash, consent_version, locale)
  values (p_request_id, p_email_hash, p_consent_version, p_locale);

  insert into public.transactional_outbox (plan_request_id, job_type)
  values (p_request_id, 'practice_plan_email_v1');

  insert into public.scoped_magic_link_grants (id, plan_request_id, token_hash, scope, expires_at)
  values (p_grant_id, p_request_id, p_grant_token_hash, 'practice_plan:view', p_grant_expires_at);

  return query select 'queued'::text, p_request_id;
exception when unique_violation then
  select id into v_existing from public.practice_plan_requests
  where interview_id = p_interview_id and plan_version = '1';
  return query select case when v_existing is null then 'conflict' else 'already_requested' end, v_existing;
end;
$$;

revoke all on function public.create_practice_plan_request(
  uuid, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_practice_plan_request(
  uuid, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz
) to service_role;

create function public.claim_practice_plan_jobs(p_limit integer, p_daily_ceiling integer)
returns table(outbox_id uuid, plan_request_id uuid, attempt_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent_today integer;
begin
  update public.transactional_outbox
  set state = 'retry', locked_at = null, available_at = now()
  where state = 'processing' and locked_at < now() - interval '10 minutes';

  select count(*) into v_sent_today
  from public.email_delivery_attempts
  where status = 'accepted' and created_at >= date_trunc('day', now());
  if v_sent_today >= p_daily_ceiling then return; end if;

  return query
  with claimed as (
    select o.id
    from public.transactional_outbox o
    join public.practice_plan_requests p on p.id = o.plan_request_id
    where o.state in ('pending', 'retry')
      and o.available_at <= now()
      and p.status not in ('bounced', 'complained', 'suppressed', 'dead_letter')
    order by o.available_at, o.created_at
    for update of o skip locked
    limit least(greatest(p_limit, 1), greatest(p_daily_ceiling - v_sent_today, 0))
  ), updated as (
    update public.transactional_outbox o
    set state = 'processing', locked_at = now(), attempts = attempts + 1
    from claimed c
    where o.id = c.id
    returning o.id, o.plan_request_id, o.attempts
  )
  select u.id, u.plan_request_id, u.attempts::integer from updated u;
end;
$$;

revoke all on function public.claim_practice_plan_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_practice_plan_jobs(integer, integer) to service_role;

create function public.delete_expired_practice_plan_data(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  with doomed as (
    select id from public.practice_plan_requests
    where expires_at <= now()
    order by expires_at
    limit least(greatest(p_limit, 1), 2000)
  ), removed as (
    delete from public.practice_plan_requests p using doomed d
    where p.id = d.id returning p.id
  ) select count(*) into v_deleted from removed;
  delete from public.resend_webhook_events where processed_at < now() - interval '90 days';
  return v_deleted;
end;
$$;

revoke all on function public.delete_expired_practice_plan_data(integer) from public, anon, authenticated;
grant execute on function public.delete_expired_practice_plan_data(integer) to service_role;

comment on table public.practice_plan_requests is 'Encrypted one-off practice plan delivery. No marketing subscription or login.';
comment on column public.practice_plan_requests.email_hash is 'HMAC-SHA256 with a dedicated server key; never a raw email.';
comment on column public.practice_plan_requests.email_ciphertext is 'AES-256-GCM envelope; server-only decryption.';
comment on table public.practice_plan_snapshots is 'Immutable schema-validated plan snapshot used for every retry.';
comment on column public.practice_plan_snapshots.plan_ciphertext is 'AES-256-GCM envelope containing the validated final plan snapshot.';
