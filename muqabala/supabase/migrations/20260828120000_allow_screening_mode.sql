alter table public.interviews drop constraint if exists interviews_mode_check;
alter table public.interviews add constraint interviews_mode_check
  check (mode in ('guided', 'mock', 'screening'));

create table public.screening_packs (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  signed_token text not null,
  workplace text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint screening_packs_code_format check (public_code ~ '^[A-Za-z0-9_-]{6,16}$')
);

create index screening_packs_expiry_idx on public.screening_packs (expires_at);

alter table public.screening_packs enable row level security;
revoke all on public.screening_packs from anon, authenticated;

comment on table public.screening_packs is 'Short public codes for 14-day work-sample links. Service role only.';
comment on column public.interviews.mode is 'guided: one practice question; mock: eight-question interview; screening: three-question work sample.';
