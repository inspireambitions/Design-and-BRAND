-- Employer volume build, section 5: time saved setting and export log.

alter table public.screening_packs
  add column if not exists minutes_per_cv integer not null default 4 check (minutes_per_cv between 0 and 120);

grant update (reminders_enabled, minutes_per_cv) on public.screening_packs to authenticated;

create table if not exists public.export_log (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  format text not null check (format in ('csv', 'pdf', 'summary_png')),
  created_at timestamptz not null default now()
);

create index if not exists export_log_role_idx on public.export_log (role_id, created_at desc);

alter table public.export_log enable row level security;
revoke all on public.export_log from public, anon, authenticated;
grant all on public.export_log to service_role;
