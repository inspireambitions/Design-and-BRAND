set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  existing_row public.interviews%rowtype;
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

  select * into existing_row
  from public.interviews
  where screening_pack_id = p_pack_id
    and candidate_user_id = p_candidate_user_id
  order by updated_at desc
  limit 1
  for update;

  if found then
    if existing_row.expires_at <= now()
      and not (existing_row.submitted_at is not null and existing_row.locked_at is not null) then
      return jsonb_build_object('status', 'expired');
    end if;
    update public.interviews
    set anonymous_token_hash = p_anonymous_token_hash,
        start_idempotency_hash = p_start_idempotency_hash
    where id = existing_row.id;
    return jsonb_build_object('status', 'resumed', 'interview_id', existing_row.id);
  end if;

  start_result := public.start_screening_interview(
    p_interview_id, p_pack_id, p_anonymous_token_hash, p_start_idempotency_hash,
    p_role_id, p_role_title, p_language, p_question_snapshot, p_role_snapshot, p_candidate_name
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
    limit greatest(1, least(coalesce(p_limit, 5), 5))
  )
  update public.screening_notification_outbox as job
  set status = 'processing',
      attempt_count = attempt_count + 1,
      locked_until = now() + interval '5 minutes',
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
