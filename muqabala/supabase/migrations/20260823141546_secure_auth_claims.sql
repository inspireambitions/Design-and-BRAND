create table public.auth_claims (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  email_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.auth_claims is
  'Short-lived, single-use ownership claims created before passwordless verification.';
comment on column public.auth_claims.state_hash is
  'SHA-256 hash only. The raw claim travels in the verification link or an HttpOnly cookie.';
comment on column public.auth_claims.email_hash is
  'SHA-256 hash of the normalised destination email. The raw address is not stored here.';

create index auth_claims_expiry_idx on public.auth_claims (expires_at);
create index auth_claims_interview_idx on public.auth_claims (interview_id);

alter table public.auth_claims enable row level security;
revoke all on public.auth_claims from anon, authenticated;

create function public.redeem_interview_claim(
  p_state_hash text,
  p_user_id uuid,
  p_email_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_row public.auth_claims%rowtype;
  claimed_interview_id uuid;
begin
  select *
  into claim_row
  from public.auth_claims
  where state_hash = p_state_hash
  for update;

  if not found
     or claim_row.used_at is not null
     or claim_row.expires_at <= now()
     or claim_row.email_hash <> p_email_hash then
    return null;
  end if;

  update public.interviews
  set user_id = p_user_id,
      anonymous_token_hash = null
  where id = claim_row.interview_id
    and (user_id is null or user_id = p_user_id)
  returning id into claimed_interview_id;

  if claimed_interview_id is null then
    return null;
  end if;

  update public.auth_claims
  set used_at = now()
  where id = claim_row.id;

  return claimed_interview_id;
end;
$$;

revoke all on function public.redeem_interview_claim(text, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_interview_claim(text, uuid, text) to service_role;

select cron.schedule(
  'muqabala-delete-expired-auth-claims',
  '27 * * * *',
  $$
    delete from public.auth_claims
    where expires_at <= now()
       or (used_at is not null and used_at <= now() - interval '1 day')
  $$
);
