-- Keep the audit log and the dashboard mirror in one transaction. The audit
-- vocabulary is shortlist/pass/later; the dashboard mirror keeps the older
-- shortlisted/not_proceeding vocabulary used by existing reports.

create or replace function public.record_employer_decision(
  p_interview_id uuid,
  p_role_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision_id uuid;
  v_now timestamptz := now();
begin
  if p_decision not in ('shortlist', 'pass', 'later') then
    raise exception 'Unknown employer decision';
  end if;

  if p_note is not null and length(p_note) > 280 then
    raise exception 'Employer decision note is too long';
  end if;

  if not exists (
    select 1
    from public.interviews i
    join public.screening_packs p on p.id = i.screening_pack_id
    where i.id = p_interview_id
      and i.screening_pack_id = p_role_id
      and i.submitted_at is not null
      and p.employer_id = p_reviewer_id
  ) then
    raise exception 'Employer decision target is not available';
  end if;

  insert into public.employer_decisions (
    interview_id,
    role_id,
    reviewer_id,
    decision,
    note
  ) values (
    p_interview_id,
    p_role_id,
    p_reviewer_id,
    p_decision,
    p_note
  )
  returning id into v_decision_id;

  update public.interviews
  set employer_reviewed_at = v_now,
      employer_decision = case p_decision
        when 'shortlist' then 'shortlisted'
        when 'pass' then 'not_proceeding'
        else null
      end,
      employer_decided_at = case when p_decision = 'later' then null else v_now end
  where id = p_interview_id
    and screening_pack_id = p_role_id;

  if not found then
    raise exception 'Employer decision target was not updated';
  end if;

  return v_decision_id;
end;
$$;

revoke all on function public.record_employer_decision(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_employer_decision(uuid, uuid, uuid, text, text) to service_role;

create or replace function public.undo_employer_decision(
  p_interview_id uuid,
  p_decision_id uuid,
  p_reviewer_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_decision text;
  v_previous_created_at timestamptz;
  v_removed integer;
begin
  if not exists (
    select 1
    from public.interviews i
    join public.screening_packs p on p.id = i.screening_pack_id
    where i.id = p_interview_id
      and i.submitted_at is not null
      and p.employer_id = p_reviewer_id
  ) then
    raise exception 'Employer decision target is not available';
  end if;

  delete from public.employer_decisions
  where id = p_decision_id
    and interview_id = p_interview_id
    and reviewer_id = p_reviewer_id;

  get diagnostics v_removed = row_count;
  if v_removed = 0 then
    return false;
  end if;

  select decision, created_at
  into v_previous_decision, v_previous_created_at
  from public.employer_decisions
  where interview_id = p_interview_id
  order by created_at desc
  limit 1;

  update public.interviews
  set employer_decision = case v_previous_decision
        when 'shortlist' then 'shortlisted'
        when 'pass' then 'not_proceeding'
        else null
      end,
      employer_decided_at = case
        when v_previous_decision in ('shortlist', 'pass') then v_previous_created_at
        else null
      end
  where id = p_interview_id;

  if not found then
    raise exception 'Employer decision target was not restored';
  end if;

  return true;
end;
$$;

revoke all on function public.undo_employer_decision(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.undo_employer_decision(uuid, uuid, uuid) to service_role;

comment on function public.record_employer_decision(uuid, uuid, uuid, text, text) is
  'Atomically records an employer decision and updates the dashboard mirror.';
comment on function public.undo_employer_decision(uuid, uuid, uuid) is
  'Atomically removes an employer decision and restores the previous dashboard state.';
