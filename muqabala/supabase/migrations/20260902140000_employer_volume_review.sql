-- Employer volume build, section 4: decision log, candidate shares and
-- shortlist email bookkeeping.

create table if not exists public.employer_decisions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('shortlist', 'pass', 'later')),
  note text check (note is null or length(note) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists employer_decisions_interview_idx on public.employer_decisions (interview_id, created_at desc);
create index if not exists employer_decisions_role_idx on public.employer_decisions (role_id, created_at desc);

alter table public.employer_decisions enable row level security;
revoke all on public.employer_decisions from public, anon, authenticated;
grant select on public.employer_decisions to authenticated;
grant all on public.employer_decisions to service_role;

drop policy if exists "Employers can read decisions for their roles" on public.employer_decisions;
create policy "Employers can read decisions for their roles"
  on public.employer_decisions for select to authenticated
  using (exists (
    select 1 from public.screening_packs p
    where p.id = employer_decisions.role_id and p.employer_id = auth.uid()
  ));

-- The legacy interviews.employer_decision column keeps the dashboard counts
-- working. It accepts the new vocabulary alongside the old values.
alter table public.interviews drop constraint if exists interviews_employer_decision_check;
alter table public.interviews add constraint interviews_employer_decision_check
  check (employer_decision is null or employer_decision in ('shortlisted', 'not_proceeding', 'shortlist', 'pass', 'later'));

create table if not exists public.candidate_shares (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  invite_id uuid references public.role_invites(id) on delete set null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  response text check (response is null or response in ('recommend', 'not_this_one')),
  responded_at timestamptz
);

create index if not exists candidate_shares_interview_idx on public.candidate_shares (interview_id, created_at desc);

alter table public.candidate_shares enable row level security;
revoke all on public.candidate_shares from public, anon, authenticated;
grant select on public.candidate_shares to authenticated;
grant all on public.candidate_shares to service_role;

drop policy if exists "Employers can read shares for their roles" on public.candidate_shares;
create policy "Employers can read shares for their roles"
  on public.candidate_shares for select to authenticated
  using (exists (
    select 1 from public.screening_packs p
    where p.id = candidate_shares.role_id and p.employer_id = auth.uid()
  ));

-- Shortlist email bookkeeping: once 48 hours after the first invite batch,
-- once when the role closes.
alter table public.screening_packs
  add column if not exists shortlist_48h_sent_at timestamptz,
  add column if not exists shortlist_close_sent_at timestamptz;
