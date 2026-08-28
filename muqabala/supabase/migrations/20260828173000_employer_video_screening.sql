set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.screening_packs
  add column if not exists employer_id uuid references auth.users(id) on delete cascade;

alter table public.interviews
  add column if not exists screening_pack_id uuid references public.screening_packs(id) on delete set null,
  add column if not exists candidate_name text,
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists locked_at timestamptz;

alter table public.interview_answers
  add column if not exists video_path text,
  add column if not exists video_mime_type text,
  add column if not exists video_size_bytes bigint,
  add column if not exists video_duration_seconds smallint,
  add column if not exists video_upload_status text not null default 'none',
  add column if not exists response_saved_at timestamptz;

alter table public.interviews
  add constraint interviews_candidate_name_length
    check (candidate_name is null or char_length(candidate_name) between 2 and 100),
  add constraint interviews_screening_submission_complete
    check (
      submitted_at is null
      or (
        mode = 'screening'
        and consented_at is not null
        and locked_at is not null
        and consent_version is not null
      )
    );

alter table public.interview_answers
  add constraint interview_answers_video_path_length
    check (video_path is null or char_length(video_path) between 8 and 500),
  add constraint interview_answers_video_size
    check (video_size_bytes is null or video_size_bytes between 1 and 52428800),
  add constraint interview_answers_video_duration
    check (video_duration_seconds is null or video_duration_seconds between 1 and 125),
  add constraint interview_answers_video_upload_status
    check (video_upload_status in ('none', 'pending', 'uploaded'));

create index if not exists screening_packs_employer_created_idx
  on public.screening_packs (employer_id, created_at desc)
  where employer_id is not null;

create index if not exists interviews_screening_pack_submitted_idx
  on public.interviews (screening_pack_id, submitted_at desc)
  where screening_pack_id is not null;

create unique index if not exists interview_answers_video_path_unique_idx
  on public.interview_answers (video_path)
  where video_path is not null;

drop policy if exists "Employers can read their screening packs" on public.screening_packs;
create policy "Employers can read their screening packs"
on public.screening_packs for select
to authenticated
using ((select auth.uid()) = employer_id);

drop policy if exists "Employers can read submitted interviews" on public.interviews;
create policy "Employers can read submitted interviews"
on public.interviews for select
to authenticated
using (
  submitted_at is not null
  and exists (
    select 1
    from public.screening_packs
    where screening_packs.id = interviews.screening_pack_id
      and screening_packs.employer_id = (select auth.uid())
  )
);

drop policy if exists "Employers can read submitted answers" on public.interview_answers;
create policy "Employers can read submitted answers"
on public.interview_answers for select
to authenticated
using (
  exists (
    select 1
    from public.interviews
    join public.screening_packs on screening_packs.id = interviews.screening_pack_id
    where interviews.id = interview_answers.interview_id
      and interviews.submitted_at is not null
      and screening_packs.employer_id = (select auth.uid())
  )
);

grant select on public.screening_packs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screening-videos',
  'screening-videos',
  false,
  52428800,
  array['video/webm', 'video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.save_screening_video_answer(
  p_interview_id uuid,
  p_anonymous_token_hash text,
  p_question_index smallint,
  p_question_id text,
  p_question_text text,
  p_transcript text,
  p_video_path text,
  p_video_mime_type text,
  p_video_size_bytes bigint,
  p_video_duration_seconds smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  interview_row public.interviews%rowtype;
  existing_path text;
begin
  select *
  into interview_row
  from public.interviews
  where id = p_interview_id
  for update;

  if not found
    or interview_row.mode <> 'screening'
    or interview_row.status <> 'in_progress'
    or interview_row.locked_at is not null
    or interview_row.anonymous_token_hash is distinct from p_anonymous_token_hash
    or p_question_index < 0
    or p_question_index >= jsonb_array_length(interview_row.question_snapshot)
    or (interview_row.question_snapshot -> p_question_index ->> 'id') is distinct from p_question_id
    or p_question_index > interview_row.current_question then
    return false;
  end if;

  select video_path into existing_path
  from public.interview_answers
  where interview_id = p_interview_id and question_index = p_question_index;

  if existing_path is not null and existing_path <> p_video_path then
    return false;
  end if;

  insert into public.interview_answers as answer (
    interview_id,
    question_index,
    question_id,
    question_text,
    transcript,
    scoring_status,
    video_path,
    video_mime_type,
    video_size_bytes,
    video_duration_seconds,
    video_upload_status,
    response_saved_at
  ) values (
    p_interview_id,
    p_question_index,
    p_question_id,
    p_question_text,
    left(p_transcript, 6000),
    case when btrim(p_transcript) = '' then 'unscored'::public.scoring_status else 'pending'::public.scoring_status end,
    p_video_path,
    p_video_mime_type,
    p_video_size_bytes,
    p_video_duration_seconds,
    'uploaded',
    now()
  )
  on conflict (interview_id, question_index) do update set
    transcript = excluded.transcript,
    scoring_status = excluded.scoring_status,
    video_mime_type = excluded.video_mime_type,
    video_size_bytes = excluded.video_size_bytes,
    video_duration_seconds = excluded.video_duration_seconds,
    video_upload_status = 'uploaded',
    response_saved_at = now()
  where answer.video_path = excluded.video_path
    and answer.video_upload_status in ('pending', 'uploaded');

  if not found then
    return false;
  end if;

  update public.interviews
  set current_question = greatest(current_question, p_question_index + 1),
      expires_at = greatest(expires_at, now() + interval '7 days')
  where id = p_interview_id;

  return true;
end;
$$;

revoke all on function public.save_screening_video_answer(
  uuid, text, smallint, text, text, text, text, text, bigint, smallint
) from public, anon, authenticated;
grant execute on function public.save_screening_video_answer(
  uuid, text, smallint, text, text, text, text, text, bigint, smallint
) to service_role;

create or replace function public.submit_screening_interview(
  p_interview_id uuid,
  p_anonymous_token_hash text,
  p_consent_version text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  interview_row public.interviews%rowtype;
  answer_count integer;
  submission_time timestamptz := now();
begin
  select *
  into interview_row
  from public.interviews
  where id = p_interview_id
  for update;

  if not found
    or interview_row.mode <> 'screening'
    or interview_row.status <> 'in_progress'
    or interview_row.locked_at is not null
    or interview_row.anonymous_token_hash is distinct from p_anonymous_token_hash then
    return null;
  end if;

  select count(*) into answer_count
  from public.interview_answers
  where interview_id = p_interview_id
    and video_upload_status = 'uploaded'
    and video_path is not null;

  if answer_count <> jsonb_array_length(interview_row.question_snapshot) then
    return null;
  end if;

  update public.interviews
  set status = 'completed',
      current_question = jsonb_array_length(question_snapshot),
      consent_version = p_consent_version,
      consented_at = submission_time,
      submitted_at = submission_time,
      locked_at = submission_time,
      completed_at = submission_time,
      expires_at = submission_time + interval '90 days'
  where id = p_interview_id;

  return submission_time;
end;
$$;

revoke all on function public.submit_screening_interview(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_screening_interview(uuid, text, text)
  to service_role;

comment on column public.screening_packs.employer_id is 'Authenticated employer who owns the link and its submitted results.';
comment on column public.interviews.candidate_name is 'Name supplied by the candidate for the inviting employer only.';
comment on column public.interviews.submitted_at is 'Final consented submission time. Employer access is blocked until this is set.';
comment on column public.interview_answers.video_path is 'Private Storage object path. Never expose as a public URL.';
comment on table public.screening_packs is 'Employer-owned short codes for 14-day video work-sample links.';

-- The older database-only cleanup cannot remove Storage objects safely. Keep
-- it for private practice, but let the authenticated app cron delete screening
-- videos through the Storage API before deleting their database rows.
select cron.unschedule(jobid)
from cron.job
where jobname = 'muqabala-delete-expired-interviews';

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
      where saved = false
        and mode <> 'screening'
        and expires_at <= now()
      order by expires_at
      limit 1000
    )
  $$
);
