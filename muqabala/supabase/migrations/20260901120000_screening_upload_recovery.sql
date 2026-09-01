set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.interviews
  add column if not exists start_idempotency_hash text;

create unique index if not exists interviews_screening_start_idempotency_idx
  on public.interviews (screening_pack_id, start_idempotency_hash)
  where screening_pack_id is not null and start_idempotency_hash is not null;

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
  if p_start_idempotency_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into pack_row
  from public.screening_packs
  where id = p_pack_id and employer_id is not null
  for update;

  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  if pack_row.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  select * into existing_interview
  from public.interviews
  where screening_pack_id = pack_row.id
    and start_idempotency_hash = p_start_idempotency_hash
    and expires_at > now()
  limit 1;

  if found then
    return jsonb_build_object('status', 'resumed', 'interview_id', existing_interview.id);
  end if;

  with abandoned as (
    update public.interviews
    set expires_at = now(),
        start_idempotency_hash = null
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
    id, user_id, anonymous_token_hash, start_idempotency_hash,
    role_id, role_title, language, mode, question_snapshot, role_snapshot,
    screening_pack_id, candidate_name
  ) values (
    p_interview_id, null, p_anonymous_token_hash, p_start_idempotency_hash,
    p_role_id, p_role_title, p_language, 'screening', p_question_snapshot,
    p_role_snapshot, pack_row.id, p_candidate_name
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

create or replace function public.preserve_screening_response_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.video_upload_status = 'uploaded'
    and old.response_saved_at is not null
    and old.video_path is not distinct from new.video_path then
    new.response_saved_at = old.response_saved_at;
  end if;
  return new;
end;
$$;

drop trigger if exists interview_answers_preserve_screening_receipt on public.interview_answers;
create trigger interview_answers_preserve_screening_receipt
before update on public.interview_answers
for each row execute function public.preserve_screening_response_receipt();

comment on column public.interviews.start_idempotency_hash is
  'SHA-256 hash of the browser start key. Prevents retries consuming another employer place.';

