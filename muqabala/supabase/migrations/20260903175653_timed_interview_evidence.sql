set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.interview_answers
  add column if not exists transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists transcript_timing_version text;

alter table public.interview_answers
  add constraint interview_answers_transcript_segments_array
    check (jsonb_typeof(transcript_segments) = 'array'),
  add constraint interview_answers_transcript_segments_size
    check (jsonb_array_length(transcript_segments) <= 240 and octet_length(transcript_segments::text) <= 131072),
  add constraint interview_answers_transcript_timing_version
    check (
      (jsonb_array_length(transcript_segments) = 0 and transcript_timing_version is null)
      or (
        jsonb_array_length(transcript_segments) > 0
        and transcript_timing_version = 'openai-whisper-segment-v1'
      )
    );

create table public.interview_evidence_records (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  answer_id uuid not null references public.interview_answers(id) on delete cascade,
  question_index smallint not null check (question_index between 0 and 49),
  evidence_key text not null check (evidence_key ~ '^E[0-9]{2,}$'),
  competency_id text not null check (competency_id ~ '^c_[a-z0-9_]{2,60}$'),
  transcript_span text not null check (char_length(transcript_span) between 1 and 1200),
  start_ms integer not null check (start_ms between 0 and 125000),
  end_ms integer not null check (end_ms > start_ms and end_ms <= 128000),
  evidence_strength text not null check (evidence_strength in ('WEAK', 'MEDIUM', 'STRONG')),
  criterion_results jsonb not null default '{}'::jsonb check (jsonb_typeof(criterion_results) = 'object'),
  pipeline_version text not null check (char_length(pipeline_version) between 3 and 80),
  created_at timestamptz not null default now(),
  unique (interview_id, evidence_key, competency_id),
  unique (answer_id, competency_id)
);

create index interview_evidence_records_interview_idx
  on public.interview_evidence_records (interview_id, question_index, evidence_key);

alter table public.interview_evidence_records enable row level security;
revoke all on public.interview_evidence_records from public, anon, authenticated;
grant select, insert, update, delete on public.interview_evidence_records to service_role;

create or replace function public.save_screening_video_answer_v2(
  p_interview_id uuid,
  p_anonymous_token_hash text,
  p_question_index smallint,
  p_question_id text,
  p_question_text text,
  p_transcript text,
  p_transcript_segments jsonb,
  p_transcript_timing_version text,
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
  if jsonb_typeof(p_transcript_segments) <> 'array'
    or jsonb_array_length(p_transcript_segments) > 240
    or octet_length(p_transcript_segments::text) > 131072
    or (
      (jsonb_array_length(p_transcript_segments) = 0 and p_transcript_timing_version is not null)
      or (
        jsonb_array_length(p_transcript_segments) > 0
        and p_transcript_timing_version is distinct from 'openai-whisper-segment-v1'
      )
    ) then
    return false;
  end if;

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
    interview_id, question_index, question_id, question_text, transcript,
    transcript_segments, transcript_timing_version, scoring_status,
    video_path, video_mime_type, video_size_bytes, video_duration_seconds,
    video_upload_status, response_saved_at
  ) values (
    p_interview_id, p_question_index, p_question_id, p_question_text, left(p_transcript, 6000),
    p_transcript_segments, p_transcript_timing_version,
    case when btrim(p_transcript) = '' then 'unscored'::public.scoring_status else 'pending'::public.scoring_status end,
    p_video_path, p_video_mime_type, p_video_size_bytes, p_video_duration_seconds,
    'uploaded', now()
  )
  on conflict (interview_id, question_index) do update set
    transcript = excluded.transcript,
    transcript_segments = excluded.transcript_segments,
    transcript_timing_version = excluded.transcript_timing_version,
    scoring_status = excluded.scoring_status,
    video_mime_type = excluded.video_mime_type,
    video_size_bytes = excluded.video_size_bytes,
    video_duration_seconds = excluded.video_duration_seconds,
    video_upload_status = 'uploaded',
    response_saved_at = now()
  where answer.video_path = excluded.video_path
    and answer.video_upload_status in ('pending', 'uploaded');

  if not found then return false; end if;

  update public.interviews
  set current_question = greatest(current_question, p_question_index + 1),
      expires_at = greatest(expires_at, now() + interval '7 days')
  where id = p_interview_id;

  return true;
end;
$$;

revoke all on function public.save_screening_video_answer_v2(
  uuid, text, smallint, text, text, text, jsonb, text, text, text, bigint, smallint
) from public, anon, authenticated;
grant execute on function public.save_screening_video_answer_v2(
  uuid, text, smallint, text, text, text, jsonb, text, text, text, bigint, smallint
) to service_role;

comment on column public.interview_answers.transcript_segments is
  'Provider timestamps for exact transcript evidence. Empty when timed transcription was unavailable.';
comment on table public.interview_evidence_records is
  'Service-only evidence spans linked to exact answer recording times. Never candidate-facing.';
