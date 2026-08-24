create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create type public.interview_status as enum ('in_progress', 'completed');
create type public.scoring_status as enum ('pending', 'scored', 'unscored', 'failed');

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_token_hash text,
  role_id text not null,
  role_title text not null,
  language text not null check (language in ('en', 'ar')),
  mode text not null check (mode in ('guided', 'mock')),
  status public.interview_status not null default 'in_progress',
  current_question smallint not null default 0 check (current_question between 0 and 50),
  question_snapshot jsonb not null check (jsonb_typeof(question_snapshot) = 'array'),
  overall_score smallint check (overall_score between 0 and 100),
  saved boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint interview_owner_present check (user_id is not null or anonymous_token_hash is not null)
);

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_index smallint not null check (question_index between 0 and 50),
  question_id text not null,
  question_text text not null,
  transcript text not null check (char_length(transcript) <= 6000),
  feedback jsonb,
  scoring_status public.scoring_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, question_index)
);

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index interviews_user_status_idx on public.interviews (user_id, status, updated_at desc);
create index interviews_anonymous_hash_idx on public.interviews (anonymous_token_hash) where anonymous_token_hash is not null;
create index interviews_expiry_idx on public.interviews (expires_at) where saved = false;
create index interview_answers_interview_idx on public.interview_answers (interview_id, question_index);
create index report_shares_owner_idx on public.report_shares (user_id, created_at desc);
create index report_shares_expiry_idx on public.report_shares (expires_at) where revoked_at is null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger interviews_set_updated_at
before update on public.interviews
for each row execute function public.set_updated_at();

create trigger interview_answers_set_updated_at
before update on public.interview_answers
for each row execute function public.set_updated_at();

alter table public.interviews enable row level security;
alter table public.interview_answers enable row level security;
alter table public.report_shares enable row level security;

create policy "Candidates can read their interviews"
on public.interviews for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Candidates can read their answers"
on public.interview_answers for select
to authenticated
using (
  exists (
    select 1 from public.interviews
    where interviews.id = interview_answers.interview_id
      and interviews.user_id = (select auth.uid())
  )
);

create policy "Candidates can read their report shares"
on public.report_shares for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.interviews from anon, authenticated;
revoke all on public.interview_answers from anon, authenticated;
revoke all on public.report_shares from anon, authenticated;
grant select on public.interviews to authenticated;
grant select on public.interview_answers to authenticated;
grant select on public.report_shares to authenticated;

comment on table public.interviews is 'Private interview attempts. Unsaved attempts expire after seven days.';
comment on column public.interviews.anonymous_token_hash is 'SHA-256 hash only. The raw token is stored in an HttpOnly cookie.';
comment on column public.report_shares.token_hash is 'SHA-256 hash only. A revocable raw token is present only in the share URL.';

select cron.schedule(
  'muqabala-delete-expired-interviews',
  '17 * * * *',
  $$
    with expired_shares as (
      delete from public.report_shares
      where expires_at <= now()
         or (revoked_at is not null and revoked_at <= now() - interval '7 days')
      returning id
    )
    delete from public.interviews
    where id in (
      select id from public.interviews
      where saved = false and expires_at <= now()
      order by expires_at
      limit 1000
    )
  $$
);
