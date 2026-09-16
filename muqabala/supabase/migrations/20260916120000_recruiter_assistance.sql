-- Recruiter assistance remains scoped to the existing screening-pack owner.
-- No table below changes private Coach practice visibility.

alter table public.screening_packs
  add column if not exists location text check (location is null or length(location) between 2 and 160),
  add column if not exists timezone text not null default 'Asia/Dubai' check (length(timezone) between 3 and 64),
  add column if not exists published_facts jsonb not null default '{}'::jsonb check (jsonb_typeof(published_facts) = 'object'),
  add column if not exists publish_key uuid,
  add column if not exists questionnaire_language text not null default 'both' check (questionnaire_language in ('en', 'both'));

alter table public.screening_packs drop constraint if exists screening_packs_question_source_check;
alter table public.screening_packs add constraint screening_packs_question_source_check
  check (question_source in ('legacy', 'catalogue', 'ai', 'employer_reviewed'));

create unique index if not exists screening_packs_employer_publish_key
  on public.screening_packs (employer_id, publish_key)
  where employer_id is not null and publish_key is not null;

alter table public.role_invites
  add column if not exists contact_allowed boolean not null default true,
  add column if not exists opted_out_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists last_manual_reminder_at timestamptz;

alter table public.employer_message_outbox
  add column if not exists message_body text check (message_body is null or length(message_body) between 1 and 2000),
  add column if not exists batch_key uuid,
  add column if not exists delivered_at timestamptz,
  add column if not exists retry_of uuid references public.employer_message_outbox(id) on delete set null;

drop index if exists public.employer_message_outbox_once_key;
create unique index employer_message_outbox_once_key
  on public.employer_message_outbox (invite_id, kind, channel)
  where invite_id is not null and kind <> 'manual_reminder';
create unique index if not exists employer_message_outbox_manual_batch_key
  on public.employer_message_outbox (invite_id, batch_key, channel)
  where invite_id is not null and kind = 'manual_reminder';
create unique index if not exists employer_message_outbox_manual_retry_once
  on public.employer_message_outbox (retry_of)
  where retry_of is not null and kind = 'manual_reminder';
create index if not exists employer_message_outbox_manual_history
  on public.employer_message_outbox (role_id, kind, invite_id, created_at desc);

alter table public.employer_message_outbox drop constraint if exists employer_message_outbox_kind_check;
alter table public.employer_message_outbox add constraint employer_message_outbox_kind_check
  check (kind in ('invite', 'reminder_1', 'reminder_2', 'completion', 'manual_reminder', 'shortlist'));
alter table public.employer_message_outbox drop constraint if exists employer_message_outbox_status_check;
alter table public.employer_message_outbox add constraint employer_message_outbox_status_check
  check (status in ('pending', 'processing', 'accepted', 'delivered', 'failed', 'cancelled'));

create table if not exists public.candidate_role_questions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  candidate_email text not null check (candidate_email = lower(candidate_email) and length(candidate_email) between 5 and 254),
  question_text text not null check (length(question_text) between 4 and 500),
  question_hash text not null check (question_hash ~ '^[0-9a-f]{64}$'),
  answer_already_shown text check (answer_already_shown is null or length(answer_already_shown) <= 1000),
  reply_text text check (reply_text is null or length(reply_text) between 1 and 2000),
  replied_at timestamptz,
  replied_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists candidate_role_questions_open_once
  on public.candidate_role_questions (role_id, candidate_id, question_hash)
  where resolved_at is null;
create index if not exists candidate_role_questions_role_queue
  on public.candidate_role_questions (role_id, resolved_at, created_at desc);

alter table public.candidate_role_questions enable row level security;
revoke all on public.candidate_role_questions from public, anon, authenticated;
grant select on public.candidate_role_questions to authenticated;
grant all on public.candidate_role_questions to service_role;
drop policy if exists "Employers can read questions for their roles" on public.candidate_role_questions;
create policy "Employers can read questions for their roles"
  on public.candidate_role_questions for select to authenticated
  using (exists (
    select 1 from public.screening_packs p
    where p.id = candidate_role_questions.role_id and p.employer_id = auth.uid()
  ));

create table if not exists public.employer_answer_summaries (
  interview_id uuid primary key references public.interviews(id) on delete cascade,
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  source_version text not null check (source_version ~ '^[0-9a-f]{64}$'),
  generation_version text not null check (length(generation_version) between 3 and 80),
  summary_points jsonb not null check (jsonb_typeof(summary_points) = 'array'),
  source_references jsonb not null check (jsonb_typeof(source_references) = 'array'),
  generated_at timestamptz not null default now()
);

alter table public.employer_answer_summaries enable row level security;
revoke all on public.employer_answer_summaries from public, anon, authenticated;
grant select on public.employer_answer_summaries to authenticated;
grant all on public.employer_answer_summaries to service_role;
drop policy if exists "Employers can read summaries for their roles" on public.employer_answer_summaries;
create policy "Employers can read summaries for their roles"
  on public.employer_answer_summaries for select to authenticated
  using (exists (
    select 1 from public.screening_packs p
    where p.id = employer_answer_summaries.role_id and p.employer_id = auth.uid()
  ));

create table if not exists public.employer_summary_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  role_id uuid not null references public.screening_packs(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  summary_version text not null check (length(summary_version) between 3 and 80),
  created_at timestamptz not null default now(),
  unique (interview_id, reported_by, summary_version)
);

alter table public.employer_summary_feedback enable row level security;
revoke all on public.employer_summary_feedback from public, anon, authenticated;
grant select on public.employer_summary_feedback to authenticated;
grant all on public.employer_summary_feedback to service_role;
drop policy if exists "Employers can read their summary feedback" on public.employer_summary_feedback;
create policy "Employers can read their summary feedback"
  on public.employer_summary_feedback for select to authenticated
  using (reported_by = auth.uid() and exists (
    select 1 from public.screening_packs p
    where p.id = employer_summary_feedback.role_id and p.employer_id = auth.uid()
  ));

create table if not exists public.recruiter_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  employer_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid references public.screening_packs(id) on delete cascade,
  record_type text not null check (length(record_type) between 2 and 50),
  record_id uuid,
  action text not null check (length(action) between 2 and 80),
  result text not null check (result in ('succeeded', 'failed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists recruiter_audit_events_owner_time
  on public.recruiter_audit_events (employer_id, created_at desc);
alter table public.recruiter_audit_events enable row level security;
revoke all on public.recruiter_audit_events from public, anon, authenticated;
grant select on public.recruiter_audit_events to authenticated;
grant all on public.recruiter_audit_events to service_role;
drop policy if exists "Employers can read their recruiter audit" on public.recruiter_audit_events;
create policy "Employers can read their recruiter audit"
  on public.recruiter_audit_events for select to authenticated using (employer_id = auth.uid());

create or replace function public.queue_manual_employer_reminders(
  p_role_id uuid,
  p_employer_id uuid,
  p_invite_ids uuid[],
  p_message text,
  p_batch_key uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_pack public.screening_packs%rowtype;
  v_queued integer := 0;
  v_requested integer := coalesce(array_length(p_invite_ids, 1), 0);
  v_existing jsonb;
begin
  select * into v_pack from public.screening_packs
    where id = p_role_id and employer_id = p_employer_id for update;
  if not found then raise exception 'Role not found' using errcode = '42501'; end if;
  if v_requested not between 1 and 500 or length(trim(p_message)) not between 1 and 2000 then
    raise exception 'Invalid reminder' using errcode = '22023';
  end if;

  select metadata into v_existing from public.recruiter_audit_events
    where employer_id = p_employer_id and role_id = p_role_id
      and record_type = 'reminder_batch' and action = 'reminders_queued'
      and metadata->>'batch_key' = p_batch_key::text
    order by created_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object(
      'queued', coalesce((v_existing->>'queued_count')::integer, 0),
      'skipped', coalesce((v_existing->>'skipped_count')::integer, 0),
      'batchKey', p_batch_key,
      'reused', true
    );
  end if;
  if v_pack.expires_at <= now() then raise exception 'Role closed' using errcode = '22023'; end if;
  if not v_pack.reminders_enabled then raise exception 'Reminders disabled' using errcode = '22023'; end if;

  insert into public.employer_message_outbox(role_id, invite_id, kind, channel, message_body, batch_key, retry_of)
    select i.role_id, i.id, 'manual_reminder', 'email', trim(p_message), p_batch_key,
      case when terminal.status = 'failed'
        and terminal.last_error_code is not null
        and terminal.last_error_code not in ('email.bounced', 'email.complained', 'email.suppressed', 'hard_bounce', 'complaint', 'provider_suppressed')
        then terminal.id else null end
    from public.role_invites i
    left join lateral (
      select previous.id, previous.status, previous.last_error_code
      from public.employer_message_outbox previous
      where previous.invite_id = i.id and previous.kind = 'manual_reminder'
      order by previous.created_at desc limit 1
    ) terminal on true
    where i.role_id = p_role_id and i.id = any(p_invite_ids)
      and i.status in ('invited', 'started') and i.email is not null
      and i.contact_allowed and i.opted_out_at is null
      and i.withdrawn_at is null and i.deleted_at is null
      and (
        terminal.id is null
        or terminal.status in ('accepted', 'delivered')
        or (terminal.status = 'failed'
          and terminal.last_error_code is not null
          and terminal.last_error_code not in ('email.bounced', 'email.complained', 'email.suppressed', 'hard_bounce', 'complaint', 'provider_suppressed'))
      )
      and not coalesce(terminal.status = 'failed'
        and terminal.last_error_code in ('email.bounced', 'email.complained', 'email.suppressed', 'hard_bounce', 'complaint', 'provider_suppressed'), false)
      and greatest(
        coalesce(i.first_reminder_at, '-infinity'::timestamptz),
        coalesce(i.second_reminder_at, '-infinity'::timestamptz),
        coalesce(i.completion_reminder_at, '-infinity'::timestamptz)
      ) <= now() - interval '24 hours'
      and (
        coalesce(i.last_manual_reminder_at, '-infinity'::timestamptz) <= now() - interval '24 hours'
        or (terminal.status = 'failed'
          and terminal.last_error_code is not null
          and terminal.last_error_code not in ('email.bounced', 'email.complained', 'email.suppressed', 'hard_bounce', 'complaint', 'provider_suppressed'))
      )
      and not exists (
        select 1 from public.employer_message_outbox existing
        where existing.invite_id = i.id and existing.kind = 'manual_reminder'
          and (
            existing.status in ('pending', 'processing')
            or (
              existing.status in ('accepted', 'delivered')
              and greatest(existing.created_at, existing.updated_at) > now() - interval '24 hours'
            )
          )
      )
    on conflict do nothing;
  get diagnostics v_queued = row_count;

  insert into public.recruiter_audit_events(
    actor_id, employer_id, role_id, record_type, action, result, metadata
  ) values (
    p_employer_id, p_employer_id, p_role_id, 'reminder_batch', 'reminders_queued', 'succeeded',
    jsonb_build_object(
      'requested_count', v_requested,
      'queued_count', v_queued,
      'skipped_count', greatest(0, v_requested - v_queued),
      'batch_key', p_batch_key
    )
  );
  return jsonb_build_object('queued', v_queued, 'skipped', greatest(0, v_requested - v_queued), 'batchKey', p_batch_key);
end;
$$;

revoke all on function public.queue_manual_employer_reminders(uuid, uuid, uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.queue_manual_employer_reminders(uuid, uuid, uuid[], text, uuid) to service_role;

create or replace function public.stamp_accepted_employer_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;
  if new.accepted_at is null then raise exception 'employer_message_acceptance_time_missing'; end if;
  if new.kind = 'shortlist' then return new; end if;
  update public.role_invites
  set invited_at = case when new.kind = 'invite' then coalesce(invited_at, new.accepted_at) else invited_at end,
      first_reminder_at = case when new.kind = 'reminder_1' then coalesce(first_reminder_at, new.accepted_at) else first_reminder_at end,
      second_reminder_at = case when new.kind = 'reminder_2' then coalesce(second_reminder_at, new.accepted_at) else second_reminder_at end,
      completion_reminder_at = case when new.kind = 'completion' then coalesce(completion_reminder_at, new.accepted_at) else completion_reminder_at end,
      last_manual_reminder_at = case when new.kind = 'manual_reminder' then coalesce(last_manual_reminder_at, new.accepted_at) else last_manual_reminder_at end
  where id = new.invite_id and role_id = new.role_id;
  if not found then raise exception 'employer_message_invite_scope_missing'; end if;
  return new;
end;
$$;

comment on table public.candidate_role_questions is 'Candidate-authored role questions. Employer-only queue reads; private Coach practice never contributes.';
comment on table public.employer_answer_summaries is 'Extractive, source-linked summaries of explicitly submitted employer interviews.';
comment on column public.screening_packs.publish_key is 'Per-employer idempotency key for one intended role publication.';
