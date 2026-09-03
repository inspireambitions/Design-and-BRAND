create table public.universal_interviews (
  id uuid primary key,
  owner_token_hash text not null,
  state_ciphertext text not null check (state_ciphertext like 'v1.%'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  processing_token_hash text,
  processing_until timestamptz,
  expires_at timestamptz not null default (now() + interval '90 days')
);

create table public.universal_interview_accounts (
  interview_id uuid primary key references public.universal_interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, interview_id)
);

create table public.universal_decision_logs (
  interview_id uuid not null references public.universal_interviews(id) on delete cascade,
  turn smallint not null check (turn >= 0),
  prompt_version text not null,
  precheck text,
  t1_action text,
  code_action text not null,
  override_reason text,
  dedupe_hit boolean not null default false,
  probe_count smallint not null check (probe_count between 0 and 2),
  model_calls smallint not null check (model_calls between 0 and 2),
  latency_ms integer not null check (latency_ms >= 0),
  schema_retry boolean not null default false,
  fallback_used boolean not null default false,
  sufficient_competencies smallint not null default 0 check (sufficient_competencies between 0 and 12),
  stripped_patterns text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (interview_id, turn)
);

create table public.universal_stage_logs (
  id bigint generated always as identity primary key,
  interview_id uuid not null references public.universal_interviews(id) on delete cascade,
  stage text not null check (stage in ('P1', 'P2', 'TURN', 'F1', 'RETRY')),
  prompt_version text not null,
  model_calls smallint not null check (model_calls between 0 and 2),
  schema_retry boolean not null default false,
  fallback_used boolean not null default false,
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index universal_interviews_expiry_idx on public.universal_interviews (expires_at);
create index universal_interviews_processing_idx on public.universal_interviews (processing_until) where processing_until is not null;
create index universal_interview_accounts_user_idx on public.universal_interview_accounts (user_id, created_at desc);
create index universal_decision_prompt_idx on public.universal_decision_logs (prompt_version, created_at desc);
create index universal_stage_prompt_idx on public.universal_stage_logs (prompt_version, stage, created_at desc);

alter table public.universal_interviews enable row level security;
alter table public.universal_interview_accounts enable row level security;
alter table public.universal_decision_logs enable row level security;
alter table public.universal_stage_logs enable row level security;

revoke all on public.universal_interviews from anon, authenticated;
revoke all on public.universal_interview_accounts from anon, authenticated;
revoke all on public.universal_decision_logs from anon, authenticated;
revoke all on public.universal_stage_logs from anon, authenticated;

comment on table public.universal_interviews is 'Encrypted Universal Interview Brain V2 state. Account identity is held separately.';
comment on column public.universal_interviews.state_ciphertext is 'AES-256-GCM ciphertext produced by the application. Never plaintext candidate data.';
comment on table public.universal_decision_logs is 'Operational decisions only. This table must never contain candidate answer text.';
comment on table public.universal_stage_logs is 'Privacy-safe stage latency and fallback metrics. No candidate text.';

create view public.universal_interview_metrics_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at) as day,
  prompt_version,
  stage,
  count(*) as stage_runs,
  percentile_disc(0.95) within group (order by latency_ms) as p95_latency_ms,
  avg(model_calls)::numeric(6, 3) as average_model_calls,
  avg((schema_retry)::int)::numeric(6, 3) as schema_retry_rate,
  avg((fallback_used)::int)::numeric(6, 3) as fallback_rate
from public.universal_stage_logs
group by 1, 2, 3;

create view public.universal_turn_metrics_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at) as day,
  prompt_version,
  count(*) as turns,
  avg((code_action like 'PROBE_%')::int)::numeric(6, 3) as probe_rate,
  avg((dedupe_hit)::int)::numeric(6, 3) as dedupe_block_rate,
  avg((fallback_used)::int)::numeric(6, 3) as fallback_rate,
  avg(sufficient_competencies)::numeric(6, 3) as average_sufficient_competencies
from public.universal_decision_logs
group by 1, 2;

revoke all on public.universal_interview_metrics_daily from anon, authenticated;
revoke all on public.universal_turn_metrics_daily from anon, authenticated;

select cron.schedule(
  'muqabala-delete-expired-universal-interviews',
  '43 2 * * *',
  $$
    delete from public.universal_interviews
    where id in (
      select id from public.universal_interviews
      where expires_at <= now()
      order by expires_at
      limit 1000
    )
  $$
);
