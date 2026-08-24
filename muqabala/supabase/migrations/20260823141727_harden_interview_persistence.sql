alter table public.interviews
add column role_snapshot jsonb;

alter table public.interviews
add constraint interviews_role_snapshot_object
check (role_snapshot is null or jsonb_typeof(role_snapshot) = 'object');

alter table public.interview_answers
add column scoring_claim_hash text;

drop index if exists public.interview_answers_interview_idx;

create function public.save_interview_progress(
  p_interview_id uuid,
  p_user_id uuid,
  p_anonymous_token_hash text,
  p_question_index smallint,
  p_question_id text,
  p_question_text text,
  p_transcript text,
  p_current_question smallint,
  p_status public.interview_status,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  interview_row public.interviews%rowtype;
begin
  select *
  into interview_row
  from public.interviews
  where id = p_interview_id
  for update;

  if not found then
    return false;
  end if;

  if not (
    (p_user_id is not null and interview_row.user_id = p_user_id)
    or (
      p_user_id is null
      and p_anonymous_token_hash is not null
      and interview_row.user_id is null
      and interview_row.anonymous_token_hash = p_anonymous_token_hash
    )
  ) then
    return false;
  end if;

  insert into public.interview_answers as existing_answer (
    interview_id,
    question_index,
    question_id,
    question_text,
    transcript
  ) values (
    p_interview_id,
    p_question_index,
    p_question_id,
    p_question_text,
    p_transcript
  )
  on conflict (interview_id, question_index)
  do update set
    question_id = excluded.question_id,
    question_text = excluded.question_text,
    transcript = excluded.transcript
  -- Once an AI job owns this answer, a late browser autosave cannot change the
  -- transcript underneath that job. A deliberate retry is claimed by the
  -- scoring RPC and creates a new claim hash.
  where existing_answer.scoring_claim_hash is null;

  update public.interviews
  set current_question = greatest(current_question, p_current_question),
      status = case
        when status = 'completed' then status
        else p_status
      end,
      completed_at = case
        when status = 'completed' then completed_at
        when p_status = 'completed' then now()
        else null
      end,
      expires_at = case when saved then expires_at else p_expires_at end
  where id = p_interview_id;

  return true;
end;
$$;

revoke all on function public.save_interview_progress(
  uuid, uuid, text, smallint, text, text, text, smallint, public.interview_status, timestamptz
) from public, anon, authenticated;
grant execute on function public.save_interview_progress(
  uuid, uuid, text, smallint, text, text, text, smallint, public.interview_status, timestamptz
) to service_role;

create function public.create_report_share(
  p_interview_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_id uuid;
begin
  perform 1
  from public.interviews
  where id = p_interview_id and user_id = p_user_id
  for update;
  if not found then
    return null;
  end if;

  if (
    select count(*)
    from public.report_shares
    where interview_id = p_interview_id
      and user_id = p_user_id
      and revoked_at is null
      and expires_at > now()
  ) >= 5 then
    return null;
  end if;

  insert into public.report_shares (interview_id, user_id, token_hash, expires_at)
  values (p_interview_id, p_user_id, p_token_hash, p_expires_at)
  returning id into share_id;
  return share_id;
end;
$$;

revoke all on function public.create_report_share(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_report_share(uuid, uuid, text, timestamptz) to service_role;

-- Claim one scoring job across every serverless instance. A repeated request
-- receives the stored result, or a short "already active" response, instead of
-- paying a provider twice for the same answer.
create function public.claim_interview_scoring(
  p_interview_id uuid,
  p_question_index integer,
  p_question_id text,
  p_question_text text,
  p_transcript text,
  p_scoring_claim_hash text
)
returns table(was_claimed boolean, existing_status public.scoring_status, existing_feedback jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.interview_answers%rowtype;
begin
  -- Serialise a first-time insert as well as repeat requests. Row-locking only
  -- interview_answers would not protect the moment before that row exists.
  perform 1 from public.interviews where id = p_interview_id for update;
  if not found then
    return;
  end if;

  select * into v_row
  from public.interview_answers
  where interview_id = p_interview_id and question_index = p_question_index
  for update;

  if found and v_row.transcript = p_transcript
    and v_row.scoring_status in ('scored', 'unscored')
    and v_row.feedback is not null then
    return query select false, v_row.scoring_status, v_row.feedback;
    return;
  end if;

  if found and v_row.scoring_status = 'pending' and v_row.scoring_claim_hash is not null
    and v_row.updated_at > now() - interval '75 seconds' then
    return query select false, v_row.scoring_status, null::jsonb;
    return;
  end if;

  insert into public.interview_answers (
    interview_id, question_index, question_id, question_text, transcript, scoring_status, feedback, scoring_claim_hash
  ) values (
    p_interview_id, p_question_index, p_question_id, p_question_text, p_transcript, 'pending', null, p_scoring_claim_hash
  )
  on conflict (interview_id, question_index) do update set
    question_id = excluded.question_id,
    question_text = excluded.question_text,
    transcript = excluded.transcript,
    scoring_status = 'pending',
    feedback = null,
    scoring_claim_hash = excluded.scoring_claim_hash;

  return query select true, 'pending'::public.scoring_status, null::jsonb;
end;
$$;

revoke all on function public.claim_interview_scoring(uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_interview_scoring(uuid, integer, text, text, text, text) to service_role;
