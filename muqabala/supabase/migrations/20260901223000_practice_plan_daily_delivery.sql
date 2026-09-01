-- Practice plan v2: captured after the first feedback, one email a day for
-- seven days, with consent recorded against the request. Extends the tables
-- created in 20260830103114_practice_plan_delivery.sql. File only: apply
-- through the normal migration review, never by hand against production.

alter table public.practice_plan_requests
  alter column interview_id drop not null,
  drop constraint if exists practice_plan_requests_plan_version_check,
  add constraint practice_plan_requests_plan_version_check check (plan_version in ('1', '2')),
  add column role_id text,
  add column question_id text,
  add column mode text check (mode in ('type', 'speak', 'video')),
  add column consented_at timestamptz,
  add column consent_source text check (consent_source in ('feedback_card', 'advert_pack')),
  add column last_sent_day smallint check (last_sent_day between 1 and 7);

-- A candidate may keep feedback for several roles; idempotency lives on
-- client_request_id and the per-email daily cap, not on the interview.
alter table public.practice_plan_requests
  drop constraint if exists practice_plan_requests_interview_id_plan_version_key;

create index practice_plan_requests_interview_idx on public.practice_plan_requests (interview_id) where interview_id is not null;

alter table public.practice_plan_snapshots
  drop constraint if exists practice_plan_snapshots_plan_version_check,
  add constraint practice_plan_snapshots_plan_version_check check (plan_version in ('1', '2'));

alter table public.plan_delivery_consents
  drop constraint if exists plan_delivery_consents_consent_version_check,
  add constraint plan_delivery_consents_consent_version_check
    check (consent_version in ('practice-plan-delivery-v1', 'practice-plan-delivery-v2')),
  add column consented_at timestamptz not null default now(),
  add column consent_source text check (consent_source in ('feedback_card', 'advert_pack'));

-- One outbox job per day of the plan.
alter table public.transactional_outbox
  drop constraint if exists transactional_outbox_job_type_check,
  add constraint transactional_outbox_job_type_check
    check (job_type in ('practice_plan_email_v1', 'practice_plan_email_v2')),
  add column plan_day smallint not null default 1 check (plan_day between 1 and 7),
  drop constraint if exists transactional_outbox_plan_request_id_job_type_key,
  add constraint transactional_outbox_plan_request_day_key unique (plan_request_id, job_type, plan_day);

alter table public.email_delivery_attempts
  add column plan_day smallint not null default 1 check (plan_day between 1 and 7),
  drop constraint if exists email_delivery_attempts_plan_request_id_attempt_number_key,
  add constraint email_delivery_attempts_request_day_attempt_key unique (plan_request_id, plan_day, attempt_number);

create index email_delivery_attempts_message_idx on public.email_delivery_attempts (provider_message_id) where provider_message_id is not null;

create function public.create_practice_plan_request_v2(
  p_request_id uuid,
  p_interview_id uuid,
  p_role_id text,
  p_question_id text,
  p_mode text,
  p_client_request_id uuid,
  p_locale text,
  p_email_hash text,
  p_email_ciphertext text,
  p_plan_ciphertext text,
  p_plan_digest text,
  p_provider_idempotency_key text,
  p_consent_version text,
  p_consent_source text,
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
  v_day smallint;
begin
  select id into v_existing from public.practice_plan_requests
  where client_request_id = p_client_request_id;
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

  if p_interview_id is not null and not exists (
    select 1 from public.interviews where id = p_interview_id
  ) then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  insert into public.practice_plan_requests (
    id, interview_id, plan_version, locale, client_request_id, email_hash,
    email_ciphertext, provider_idempotency_key, expires_at,
    role_id, question_id, mode, consented_at, consent_source
  ) values (
    p_request_id, p_interview_id, '2', p_locale, p_client_request_id, p_email_hash,
    p_email_ciphertext, p_provider_idempotency_key, p_data_expires_at,
    p_role_id, p_question_id, p_mode, now(), p_consent_source
  );

  insert into public.practice_plan_snapshots (
    plan_request_id, plan_version, plan_ciphertext, plan_digest
  ) values (p_request_id, '2', p_plan_ciphertext, p_plan_digest);

  insert into public.plan_delivery_consents (plan_request_id, email_hash, consent_version, locale, consented_at, consent_source)
  values (p_request_id, p_email_hash, p_consent_version, p_locale, now(), p_consent_source);

  -- Day 1 goes now; each later day is released 24 hours after the previous one.
  for v_day in 1..7 loop
    insert into public.transactional_outbox (plan_request_id, job_type, plan_day, available_at)
    values (p_request_id, 'practice_plan_email_v2', v_day, now() + ((v_day - 1) * interval '1 day'));
  end loop;

  insert into public.scoped_magic_link_grants (id, plan_request_id, token_hash, scope, expires_at)
  values (p_grant_id, p_request_id, p_grant_token_hash, 'practice_plan:view', p_grant_expires_at);

  return query select 'queued'::text, p_request_id;
exception when unique_violation then
  select id into v_existing from public.practice_plan_requests
  where client_request_id = p_client_request_id;
  return query select case when v_existing is null then 'conflict' else 'already_requested' end, v_existing;
end;
$$;

revoke all on function public.create_practice_plan_request_v2(
  uuid, uuid, text, text, text, uuid, text, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_practice_plan_request_v2(
  uuid, uuid, text, text, text, uuid, text, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz
) to service_role;

-- The claim now reports which day of the plan a job belongs to.
drop function if exists public.claim_practice_plan_jobs(integer, integer);

create function public.claim_practice_plan_jobs(p_limit integer, p_daily_ceiling integer)
returns table(outbox_id uuid, plan_request_id uuid, attempt_number integer, plan_day integer)
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
      and p.expires_at > now()
      and p.status not in ('bounced', 'complained', 'suppressed', 'dead_letter')
    order by o.available_at, o.created_at
    for update of o skip locked
    limit least(greatest(p_limit, 1), greatest(p_daily_ceiling - v_sent_today, 0))
  ), updated as (
    update public.transactional_outbox o
    set state = 'processing', locked_at = now(), attempts = attempts + 1
    from claimed c
    where o.id = c.id
    returning o.id, o.plan_request_id, o.attempts, o.plan_day
  )
  select u.id, u.plan_request_id, u.attempts::integer, u.plan_day::integer from updated u;
end;
$$;

revoke all on function public.claim_practice_plan_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_practice_plan_jobs(integer, integer) to service_role;

comment on column public.practice_plan_requests.consented_at is 'Server time of the candidate''s consent to the seven-day plan emails.';
comment on column public.practice_plan_requests.consent_source is 'Where consent was given: the Keep this feedback card or the advert pack.';
comment on column public.transactional_outbox.plan_day is 'Day of the seven-day plan this email delivers, released 24 hours apart.';
