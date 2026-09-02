-- Employer volume build, section 2: per-candidate invites and an outbox for
-- invite, reminder and shortlist messages. A "role" is a screening_packs row.

create table if not exists public.role_invites (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  candidate_ref text not null unique check (candidate_ref ~ '^MQ-[A-HJ-NP-Z2-9]{6}$'),
  email text check (email is null or (length(email) between 5 and 254 and email = lower(email))),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  name text check (name is null or length(name) between 1 and 100),
  channel text not null check (channel in ('email', 'whatsapp', 'both')),
  -- Random token. Looked up by SHA-256 hex digest; an AES-GCM copy is kept so
  -- reminders can resend the same link. The plain token is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_cipher text not null,
  invited_at timestamptz,
  first_reminder_at timestamptz,
  second_reminder_at timestamptz,
  completion_reminder_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'invited' check (status in ('invited', 'started', 'submitted', 'expired')),
  created_at timestamptz not null default now(),
  constraint role_invites_has_contact check (email is not null or phone is not null)
);

create unique index if not exists role_invites_role_email_key on public.role_invites (role_id, lower(email)) where email is not null;
create unique index if not exists role_invites_role_phone_key on public.role_invites (role_id, phone) where phone is not null;
create index if not exists role_invites_role_status_idx on public.role_invites (role_id, status);
create index if not exists role_invites_reminder_idx on public.role_invites (status, invited_at) where status in ('invited', 'started');

alter table public.role_invites enable row level security;
revoke all on public.role_invites from public, anon, authenticated;
grant select on public.role_invites to authenticated;
grant all on public.role_invites to service_role;

-- Employers read only invites for roles they own. Nothing else is granted to
-- JWT roles; all writes go through the service role in API routes.
drop policy if exists "Employers can read invites for their roles" on public.role_invites;
create policy "Employers can read invites for their roles"
  on public.role_invites for select to authenticated
  using (exists (
    select 1 from public.screening_packs p
    where p.id = role_invites.role_id and p.employer_id = auth.uid()
  ));

-- Bind a candidate interview to the invite it arrived through.
alter table public.interviews add column if not exists invite_id uuid references public.role_invites(id) on delete set null;
create index if not exists interviews_invite_idx on public.interviews (invite_id) where invite_id is not null;

-- Outbox for every employer volume message. Claimed with skip locked, sent in
-- the background, rate limited to the provider.
create table if not exists public.employer_message_outbox (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  invite_id uuid references public.role_invites(id) on delete cascade,
  kind text not null check (kind in ('invite', 'reminder_1', 'reminder_2', 'completion', 'shortlist')),
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lease_token uuid,
  provider_message_id text,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employer_message_outbox_once_key
  on public.employer_message_outbox (invite_id, kind, channel) where invite_id is not null;
create index if not exists employer_message_outbox_claim_idx
  on public.employer_message_outbox (status, available_at) where status = 'pending';

alter table public.employer_message_outbox enable row level security;
revoke all on public.employer_message_outbox from public, anon, authenticated;
grant all on public.employer_message_outbox to service_role;

create or replace function public.claim_employer_messages(p_limit integer, p_lease_token uuid, p_role_id uuid default null)
returns setof public.employer_message_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id from public.employer_message_outbox
    where status = 'pending'
      and available_at <= now()
      and attempt_count < 10
      and (p_role_id is null or role_id = p_role_id)
    order by available_at
    limit least(greatest(coalesce(p_limit, 1), 1), 50)
    for update skip locked
  )
  update public.employer_message_outbox o
  set status = 'processing',
      locked_until = now() + interval '5 minutes',
      lease_token = p_lease_token,
      attempt_count = o.attempt_count + 1,
      updated_at = now()
  from picked
  where o.id = picked.id
  returning o.*;
end;
$$;

revoke all on function public.claim_employer_messages(integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_employer_messages(integer, uuid, uuid) to service_role;

-- Mark invites started and submitted from the candidate flow. Called by the
-- service role only; the token is compared as a hash.
create or replace function public.bind_invite_to_interview(p_token_hash text, p_interview_id uuid)
returns table (invite_id uuid, role_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.role_invites%rowtype;
begin
  select * into v_invite from public.role_invites i
  where i.token_hash = p_token_hash
  for update;
  if not found then return; end if;
  if v_invite.status = 'expired' then return; end if;
  if exists (select 1 from public.screening_packs p where p.id = v_invite.role_id and p.expires_at <= now()) then
    update public.role_invites set status = 'expired' where id = v_invite.id;
    return;
  end if;
  update public.interviews set invite_id = v_invite.id where id = p_interview_id and screening_pack_id = v_invite.role_id;
  if v_invite.status = 'invited' then
    update public.role_invites set status = 'started', started_at = coalesce(started_at, now()) where id = v_invite.id;
  end if;
  return query select v_invite.id, v_invite.role_id;
end;
$$;

revoke all on function public.bind_invite_to_interview(text, uuid) from public, anon, authenticated;
grant execute on function public.bind_invite_to_interview(text, uuid) to service_role;

-- Keep invite status in step with submission without touching the existing
-- submit RPCs.
create or replace function public.mark_invite_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submitted_at is not null and new.invite_id is not null and (old.submitted_at is null) then
    update public.role_invites
    set status = 'submitted', submitted_at = coalesce(submitted_at, new.submitted_at)
    where id = new.invite_id;
  end if;
  return new;
end;
$$;

drop trigger if exists interviews_mark_invite_submitted on public.interviews;
create trigger interviews_mark_invite_submitted
  after update of submitted_at on public.interviews
  for each row execute function public.mark_invite_submitted();
