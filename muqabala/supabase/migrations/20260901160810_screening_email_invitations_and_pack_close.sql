set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.screening_packs
  add column if not exists closed_at timestamptz;

create table if not exists public.screening_email_invitations (
  id uuid primary key default gen_random_uuid(),
  screening_pack_id uuid not null references public.screening_packs(id) on delete cascade,
  employer_id uuid not null references auth.users(id) on delete cascade,
  recipient_email_hash text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status text not null default 'pending',
  provider_message_id text,
  accepted_at timestamptz,
  candidate_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screening_email_invitations_email_hash_format
    check (recipient_email_hash ~ '^[a-f0-9]{64}$'),
  constraint screening_email_invitations_token_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint screening_email_invitations_status
    check (status in ('pending', 'accepted', 'failed')),
  constraint screening_email_invitations_claim_pair
    check (
      (candidate_user_id is null and claimed_at is null)
      or (candidate_user_id is not null and claimed_at is not null)
    ),
  unique (screening_pack_id, recipient_email_hash)
);

create index if not exists screening_email_invitations_pack_created_idx
  on public.screening_email_invitations (screening_pack_id, created_at desc);

create index if not exists screening_email_invitations_expiry_idx
  on public.screening_email_invitations (expires_at)
  where claimed_at is null;

alter table public.screening_email_invitations enable row level security;
revoke all on table public.screening_email_invitations from public, anon, authenticated;
grant select, insert, update, delete on table public.screening_email_invitations to service_role;

create or replace function public.claim_screening_email_invitation(
  p_pack_id uuid,
  p_token_hash text,
  p_recipient_email_hash text,
  p_candidate_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_row public.screening_email_invitations%rowtype;
  pack_row public.screening_packs%rowtype;
  has_existing_interview boolean := false;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or p_recipient_email_hash !~ '^[a-f0-9]{64}$'
    or p_candidate_user_id is null then
    return 'unavailable';
  end if;

  select * into invitation_row
  from public.screening_email_invitations
  where screening_pack_id = p_pack_id
    and token_hash = p_token_hash
  for update;

  if not found
    or invitation_row.recipient_email_hash <> p_recipient_email_hash
    or invitation_row.expires_at <= now() then
    return 'unavailable';
  end if;

  if invitation_row.candidate_user_id is not null
    and invitation_row.candidate_user_id <> p_candidate_user_id then
    return 'unavailable';
  end if;

  select * into pack_row
  from public.screening_packs
  where id = p_pack_id
    and employer_id = invitation_row.employer_id;

  if not found then return 'unavailable'; end if;

  select exists (
    select 1 from public.interviews
    where screening_pack_id = p_pack_id
      and candidate_user_id = p_candidate_user_id
      and mode = 'screening'
  ) into has_existing_interview;

  if (pack_row.closed_at is not null or pack_row.expires_at <= now()
      or pack_row.starts_used >= pack_row.max_candidates)
    and not has_existing_interview then
    return case
      when pack_row.closed_at is not null then 'closed'
      when pack_row.expires_at <= now() then 'expired'
      else 'full'
    end;
  end if;

  update public.screening_email_invitations
  set candidate_user_id = coalesce(candidate_user_id, p_candidate_user_id),
      claimed_at = coalesce(claimed_at, now()),
      updated_at = now()
  where id = invitation_row.id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_screening_email_invitation(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_screening_email_invitation(uuid, text, text, uuid)
  to service_role;

comment on column public.screening_packs.closed_at is
  'Manual employer closure time. New starts stop, while an existing candidate interview may resume.';
comment on table public.screening_email_invitations is
  'Service-role-only email invitation records. Stores keyed email and opaque token hashes, never raw addresses or tokens.';
comment on column public.screening_email_invitations.status is
  'Resend request state. Accepted means the provider accepted the request; it does not claim inbox delivery.';

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
  pack_row public.screening_packs%rowtype;
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

  select * into pack_row
  from public.screening_packs
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

  if pack_row.closed_at is not null then
    return jsonb_build_object('status', 'closed');
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
