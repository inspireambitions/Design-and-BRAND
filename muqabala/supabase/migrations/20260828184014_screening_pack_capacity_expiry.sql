set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.screening_packs
  add column if not exists max_candidates integer not null default 100,
  add column if not exists starts_used integer not null default 0;

with existing_starts as (
  select screening_pack_id, count(*)::integer as total
  from public.interviews
  where mode = 'screening' and screening_pack_id is not null
  group by screening_pack_id
)
update public.screening_packs as pack
set starts_used = existing_starts.total,
    max_candidates = greatest(pack.max_candidates, existing_starts.total)
from existing_starts
where existing_starts.screening_pack_id = pack.id;

alter table public.screening_packs
  add constraint screening_packs_max_candidates_range
    check (max_candidates between 1 and 1000),
  add constraint screening_packs_starts_used_range
    check (starts_used between 0 and max_candidates);

create or replace function public.start_screening_interview(
  p_interview_id uuid,
  p_pack_id uuid,
  p_anonymous_token_hash text,
  p_role_id text,
  p_role_title text,
  p_language text,
  p_question_snapshot jsonb,
  p_role_snapshot jsonb,
  p_candidate_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pack_row public.screening_packs%rowtype;
begin
  select *
  into pack_row
  from public.screening_packs
  where id = p_pack_id
    and employer_id is not null
  for update;

  if not found then
    return 'unavailable';
  end if;

  if pack_row.expires_at <= now() then
    return 'expired';
  end if;

  if pack_row.starts_used >= pack_row.max_candidates then
    return 'full';
  end if;

  insert into public.interviews (
    id,
    user_id,
    anonymous_token_hash,
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

  return 'started';
end;
$$;

revoke all on function public.start_screening_interview(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.start_screening_interview(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text
) to service_role;

comment on column public.screening_packs.max_candidates is
  'Maximum number of candidates allowed to start this employer work sample.';
comment on column public.screening_packs.starts_used is
  'Number of screening interviews started. Updated atomically by start_screening_interview.';
comment on function public.start_screening_interview(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text
) is 'Creates a screening interview and consumes one candidate place in the same transaction.';
