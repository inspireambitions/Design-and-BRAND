set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.interviews
  add column if not exists start_idempotency_hash text;

create unique index if not exists interviews_screening_start_idempotency_idx
  on public.interviews (screening_pack_id, start_idempotency_hash)
  where screening_pack_id is not null and start_idempotency_hash is not null;

create table if not exists public.rate_limit_counters (
  bucket text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (bucket, identifier_hash)
);

alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  counter_row public.rate_limit_counters%rowtype;
  current_time timestamptz := clock_timestamp();
begin
  if p_bucket !~ '^[a-z0-9:_-]{1,80}$'
    or p_identifier_hash !~ '^[a-f0-9]{64}$'
    or p_limit < 1
    or p_limit > 100000
    or p_window_seconds < 1
    or p_window_seconds > 604800 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limit_counters as counters (
    bucket,
    identifier_hash,
    window_started_at,
    request_count,
    expires_at
  ) values (
    p_bucket,
    p_identifier_hash,
    current_time,
    1,
    current_time + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket, identifier_hash) do update set
    window_started_at = case
      when counters.expires_at <= current_time then current_time
      else counters.window_started_at
    end,
    request_count = case
      when counters.expires_at <= current_time then 1
      else counters.request_count + 1
    end,
    expires_at = case
      when counters.expires_at <= current_time
        then current_time + make_interval(secs => p_window_seconds)
      else counters.expires_at
    end
  returning * into counter_row;

  return jsonb_build_object(
    'limited', counter_row.request_count > p_limit,
    'retry_after_seconds', case
      when counter_row.request_count > p_limit
        then greatest(1, ceil(extract(epoch from counter_row.expires_at - current_time))::integer)
      else 0
    end
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;

create or replace function public.start_screening_interview(
  p_interview_id uuid,
  p_pack_id uuid,
  p_anonymous_token_hash text,
  p_start_idempotency_hash text,
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
  pack_row public.screening_packs%rowtype;
  existing_interview public.interviews%rowtype;
  abandoned_count integer := 0;
begin
  select *
  into pack_row
  from public.screening_packs
  where id = p_pack_id
    and employer_id is not null
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if pack_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select *
  into existing_interview
  from public.interviews
  where screening_pack_id = pack_row.id
    and start_idempotency_hash = p_start_idempotency_hash
    and expires_at > now()
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'resumed',
      'interview_id', existing_interview.id
    );
  end if;

  -- A candidate has two full days to return. After that, an unfinished place
  -- is released and its expired videos are removed by the daily cleanup job.
  with abandoned as (
    update public.interviews
    set expires_at = now()
    where screening_pack_id = pack_row.id
      and mode = 'screening'
      and status = 'in_progress'
      and submitted_at is null
      and updated_at <= now() - interval '48 hours'
      and expires_at > now()
    returning id
  )
  select count(*)::integer into abandoned_count from abandoned;

  if abandoned_count > 0 then
    update public.screening_packs
    set starts_used = greatest(0, starts_used - abandoned_count)
    where id = pack_row.id
    returning * into pack_row;
  end if;

  if pack_row.starts_used >= pack_row.max_candidates then
    return jsonb_build_object('status', 'full');
  end if;

  insert into public.interviews (
    id,
    user_id,
    anonymous_token_hash,
    start_idempotency_hash,
    role_id,
    role_title,
    language,
    mode,
    question_snapshot,
    role_snapshot,
    screening_pack_id,
    candidate_name
  ) values (
    p_interview_id,
    null,
    p_anonymous_token_hash,
    p_start_idempotency_hash,
    p_role_id,
    p_role_title,
    p_language,
    'screening',
    p_question_snapshot,
    p_role_snapshot,
    pack_row.id,
    p_candidate_name
  );

  update public.screening_packs
  set starts_used = starts_used + 1
  where id = pack_row.id;

  return jsonb_build_object('status', 'started', 'interview_id', p_interview_id);
end;
$$;

revoke all on function public.start_screening_interview(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.start_screening_interview(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) to service_role;

comment on column public.interviews.start_idempotency_hash is
  'SHA-256 hash of the browser start key. Prevents one candidate refresh consuming another employer place.';
comment on table public.rate_limit_counters is
  'Deployment-wide fixed-window fallback when the primary Redis limiter is unavailable.';

select cron.schedule(
  'muqabala-delete-expired-rate-limits',
  '41 3 * * *',
  $$delete from public.rate_limit_counters where expires_at < now() - interval '1 day'$$
)
where not exists (
  select 1 from cron.job where jobname = 'muqabala-delete-expired-rate-limits'
);
