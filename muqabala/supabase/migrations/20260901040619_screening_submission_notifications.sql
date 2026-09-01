set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.interviews
  add column if not exists candidate_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists interviews_screening_candidate_pack_idx
  on public.interviews (screening_pack_id, candidate_user_id)
  where mode = 'screening' and screening_pack_id is not null and candidate_user_id is not null;

create table if not exists public.screening_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  recipient_kind text not null check (recipient_kind in ('candidate', 'employer')),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'screening_submitted'
    check (event_type = 'screening_submitted'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'accepted', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lease_token uuid,
  provider_message_id text,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, event_type, recipient_kind)
);

alter table public.screening_notification_outbox enable row level security;
revoke all on table public.screening_notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.screening_notification_outbox to service_role;

create index if not exists screening_notification_outbox_ready_idx
  on public.screening_notification_outbox (available_at, created_at)
  where status in ('pending', 'processing');

create or replace function public.start_screening_interview(
  p_interview_id uuid,
  p_pack_id uuid,
  p_anonymous_token_hash text,
  p_start_idempotency_hash text,
  p_candidate_user_id uuid,
  p_role_id text,
  p_role_title text,
  p_language text,
  p_question_snapshot jsonb,
  p_role_snapshot jsonb,
  p_candidate_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  start_result jsonb;
begin
  if p_candidate_user_id is null
    or not exists (
      select 1 from auth.users
      where id = p_candidate_user_id and email is not null and email_confirmed_at is not null
    ) then
    return jsonb_build_object('status', 'unavailable');
  end if;

  perform 1 from public.screening_packs
  where id = p_pack_id and employer_id is not null
  for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;

  select id into existing_id
  from public.interviews
  where screening_pack_id = p_pack_id
    and candidate_user_id = p_candidate_user_id
    and expires_at > now()
  order by updated_at desc
  limit 1
  for update;

  if existing_id is not null then
    update public.interviews
    set anonymous_token_hash = p_anonymous_token_hash,
        start_idempotency_hash = p_start_idempotency_hash
    where id = existing_id;
    return jsonb_build_object('status', 'resumed', 'interview_id', existing_id);
  end if;

  start_result := public.start_screening_interview(
    p_interview_id,
    p_pack_id,
    p_anonymous_token_hash,
    p_start_idempotency_hash,
    p_role_id,
    p_role_title,
    p_language,
    p_question_snapshot,
    p_role_snapshot,
    p_candidate_name
  );

  if start_result ->> 'status' = 'started' then
    update public.interviews
    set candidate_user_id = p_candidate_user_id
    where id = (start_result ->> 'interview_id')::uuid;
  end if;
  return start_result;
end;
$$;

revoke all on function public.start_screening_interview(
  uuid, uuid, text, text, uuid, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.start_screening_interview(
  uuid, uuid, text, text, uuid, text, text, text, jsonb, jsonb, text
) to service_role;

create or replace function public.submit_screening_interview(
  p_interview_id uuid,
  p_anonymous_token_hash text,
  p_candidate_user_id uuid,
  p_consent_version text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  interview_row public.interviews%rowtype;
  employer_user_id uuid;
  submission_time timestamptz;
begin
  select * into interview_row
  from public.interviews
  where id = p_interview_id
  for update;

  if not found
    or interview_row.mode <> 'screening'
    or interview_row.anonymous_token_hash is distinct from p_anonymous_token_hash
    or interview_row.candidate_user_id is distinct from p_candidate_user_id then
    return null;
  end if;

  select employer_id into employer_user_id
  from public.screening_packs
  where id = interview_row.screening_pack_id;

  if employer_user_id is null
    or not exists (
      select 1 from auth.users
      where id = p_candidate_user_id and email is not null and email_confirmed_at is not null
    )
    or not exists (
      select 1 from auth.users
      where id = employer_user_id and email is not null and email_confirmed_at is not null
    ) then
    return null;
  end if;

  if interview_row.submitted_at is not null and interview_row.locked_at is not null then
    submission_time := interview_row.submitted_at;
  else
    submission_time := public.submit_screening_interview(
      p_interview_id,
      p_anonymous_token_hash,
      p_consent_version
    );
  end if;
  if submission_time is null then return null; end if;

  insert into public.screening_notification_outbox (
    interview_id, recipient_kind, recipient_user_id
  ) values
    (p_interview_id, 'candidate', p_candidate_user_id),
    (p_interview_id, 'employer', employer_user_id)
  on conflict (interview_id, event_type, recipient_kind) do nothing;

  return submission_time;
end;
$$;

revoke all on function public.submit_screening_interview(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_screening_interview(uuid, text, uuid, text)
  to service_role;

create or replace function public.claim_screening_notifications(
  p_limit integer,
  p_interview_id uuid default null,
  p_lease_token uuid default gen_random_uuid()
)
returns setof public.screening_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select id
    from public.screening_notification_outbox
    where (p_interview_id is null or interview_id = p_interview_id)
      and attempt_count < 10
      and (
        (status = 'pending' and available_at <= now())
        or (status = 'processing' and locked_until <= now())
      )
    order by available_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.screening_notification_outbox as job
  set status = 'processing',
      attempt_count = attempt_count + 1,
      locked_until = now() + interval '2 minutes',
      lease_token = p_lease_token,
      updated_at = now()
  from picked
  where job.id = picked.id
  returning job.*;
end;
$$;

revoke all on function public.claim_screening_notifications(integer, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_screening_notifications(integer, uuid, uuid)
  to service_role;

comment on column public.interviews.candidate_user_id is
  'Verified Muqabala account that completed this employer interview. Not employer-visible before consent.';
comment on table public.screening_notification_outbox is
  'Service-role-only durable notification jobs. Stores user ids, never raw email or interview evidence.';
