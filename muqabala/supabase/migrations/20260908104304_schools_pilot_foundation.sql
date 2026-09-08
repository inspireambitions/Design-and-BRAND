-- Schools storage is deliberately separate from personal practice and recruitment.
begin;
create schema if not exists schools_private;
revoke all on schema schools_private from public;
grant usage on schema schools_private to authenticated, service_role;

create table public.schools_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.schools_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  country text not null check (length(trim(country)) between 2 and 80),
  language text not null check (language in ('en','ar')),
  setup_complete boolean not null default false,
  dpa_complete boolean not null default false,
  dpa_reference text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  data_retention_days_active integer not null default 365 check (data_retention_days_active between 1 and 3650),
  data_retention_days_archived integer not null default 90 check (data_retention_days_archived between 1 and 3650),
  created_at timestamptz not null default now(),
  check (not setup_complete or (dpa_complete and dpa_reference is not null and approved_by is not null and approved_at is not null))
);
create table public.schools_institution_members (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.schools_institutions(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('institution_admin','educator')),
  accepted_at timestamptz,
  unique(institution_id,user_id)
);
create table public.schools_cohorts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.schools_institutions(id),
  name text not null check (length(trim(name)) between 1 and 160),
  enrolment_open boolean not null default false,
  enrolment_code text not null check (enrolment_code ~ '^[A-Z0-9]{8}$'),
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(institution_id,enrolment_code)
);
create table public.schools_cohort_educators (
  cohort_id uuid not null references public.schools_cohorts(id),
  educator_user_id uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key(cohort_id,educator_user_id)
);
create table public.schools_cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.schools_cohorts(id),
  student_user_id uuid not null references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  joined_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','removed')),
  removed_at timestamptz,
  adult_confirmed_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  unique(cohort_id,student_user_id),
  check ((status='removed') = (removed_at is not null))
);
create table public.schools_question_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.schools_institutions(id),
  question_key text not null,
  version integer not null check (version>0),
  role_id text not null,
  language text not null check(language in ('en','ar')),
  question_text text not null check(length(trim(question_text)) between 1 and 1200),
  rubric jsonb not null check(jsonb_typeof(rubric)='array' and jsonb_array_length(rubric)=4),
  no_example_follow_up text not null check(length(trim(no_example_follow_up)) between 1 and 800),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(institution_id,question_key,version)
);
create table public.schools_assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.schools_cohorts(id),
  role_id text not null,
  rubric_version_id uuid not null default gen_random_uuid(),
  opens_at timestamptz not null default now(),
  due_at timestamptz not null,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(due_at>opens_at)
);
create table public.schools_assignment_questions (
  assignment_id uuid not null references public.schools_assignments(id),
  question_index smallint not null check(question_index between 0 and 2),
  question_version_id uuid not null references public.schools_question_versions(id),
  primary key(assignment_id,question_index),
  unique(assignment_id,question_version_id)
);
-- Each attempt contains all three text answers. A retry creates a new snapshot.
create table public.schools_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.schools_assignments(id),
  student_user_id uuid not null references auth.users(id),
  attempt_number integer not null check(attempt_number>0),
  status text not null default 'draft' check(status in ('draft','submitted')),
  answers jsonb not null default '["","",""]'::jsonb check(jsonb_typeof(answers)='array' and jsonb_array_length(answers)=3),
  revision integer not null default 0,
  copied_from_attempt_id uuid references public.schools_assignment_attempts(id),
  feedback_status text not null default 'pending' check(feedback_status in ('pending','processing','ready','failed')),
  feedback_version_id uuid,
  evidence_covered integer check(evidence_covered between 0 and 12),
  evidence_detail jsonb,
  feedback_opened_at timestamptz,
  comment_read_revision integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique(assignment_id,student_user_id,attempt_number),
  check((status='submitted') = (submitted_at is not null)),
  check(feedback_status<>'ready' or (feedback_version_id is not null and evidence_detail is not null and evidence_covered is not null))
);
create unique index schools_one_draft on public.schools_assignment_attempts(assignment_id,student_user_id) where status='draft';
create table public.schools_feedback_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_attempt_id uuid not null references public.schools_assignment_attempts(id),
  provider text not null,
  model text not null,
  contract_version text not null,
  output jsonb not null,
  input_tokens integer not null default 0 check(input_tokens>=0),
  output_tokens integer not null default 0 check(output_tokens>=0),
  cost_usd numeric(12,6) check(cost_usd>=0),
  created_at timestamptz not null default now()
);
alter table public.schools_assignment_attempts add constraint schools_feedback_fk foreign key(feedback_version_id) references public.schools_feedback_versions(id);
create table public.schools_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_attempt_id uuid not null unique references public.schools_assignment_attempts(id),
  educator_id uuid not null references auth.users(id),
  state text not null check(state in ('on_track','needs_more','discuss')),
  comment text not null default '' check(char_length(comment)<=280),
  previous_review_snapshot jsonb,
  undo_expires_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.schools_evidence_corrections (
  id uuid primary key default gen_random_uuid(),
  assignment_attempt_id uuid not null references public.schools_assignment_attempts(id),
  educator_id uuid not null references auth.users(id),
  question_index smallint not null check(question_index between 0 and 2),
  rubric_element text not null,
  original_present boolean not null,
  corrected_present boolean not null,
  reason text not null check(length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.schools_support_requests (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.schools_cohorts(id),
  student_user_id uuid not null references auth.users(id),
  created_by text not null check(created_by in ('student','educator')),
  owner_educator_id uuid references auth.users(id),
  status text not null default 'open' check(status in ('open','scheduled','closed')),
  note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.schools_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  target_table text not null,
  target_id uuid,
  institution_id uuid not null references public.schools_institutions(id),
  created_at timestamptz not null default now()
);
create index schools_members_user on public.schools_institution_members(user_id,institution_id);
create index schools_students_user on public.schools_cohort_members(student_user_id,cohort_id);
create index schools_educators_user on public.schools_cohort_educators(educator_user_id,cohort_id);
create index schools_attempts_assignment on public.schools_assignment_attempts(assignment_id,status,submitted_at);
create index schools_support_cohort on public.schools_support_requests(cohort_id,status);

-- Helpers use trusted database membership, never editable user metadata.
-- Their schema is not exposed through PostgREST. Every lookup binds auth.uid().
create table public.schools_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.schools_sessions enable row level security;
revoke all on public.schools_sessions from public,anon,authenticated;
grant all on public.schools_sessions to service_role;
create index schools_sessions_user on public.schools_sessions(user_id);
create function schools_private.session_active() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.schools_sessions s where s.user_id=auth.uid()
    and s.session_id::text=auth.jwt()->>'session_id' and s.revoked_at is null and s.last_seen_at>now()-interval '12 hours');
$$;
revoke all on function schools_private.session_active() from public,anon;
grant execute on function schools_private.session_active() to authenticated,service_role;
create function schools_private.is_founder() returns boolean
language sql stable security definer set search_path='' as $$
  select schools_private.session_active() and exists(select 1 from public.schools_staff where user_id=auth.uid());
$$;
create function schools_private.is_admin(institution uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select schools_private.session_active() and exists(select 1 from public.schools_institution_members
    where institution_id=institution and user_id=auth.uid() and role='institution_admin' and accepted_at is not null);
$$;
create function schools_private.is_educator(cohort uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.schools_cohort_educators e
    join public.schools_cohorts c on c.id=e.cohort_id
    join public.schools_institution_members m on m.institution_id=c.institution_id
      and m.user_id=e.educator_user_id and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=auth.uid());
$$;
create function schools_private.is_student(cohort uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select schools_private.session_active() and exists(select 1 from public.schools_cohort_members
    where cohort_id=cohort and student_user_id=auth.uid() and status='active');
$$;
create function schools_private.can_read_attempt(attempt uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.schools_assignment_attempts t
    join public.schools_assignments a on a.id=t.assignment_id
    where t.id=attempt and (
      schools_private.is_founder()
      or (t.student_user_id=auth.uid() and schools_private.is_student(a.cohort_id))
      or (t.status='submitted' and schools_private.is_educator(a.cohort_id))));
$$;
create function schools_private.can_read_assignment(assignment uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.schools_assignments a
    join public.schools_cohorts c on c.id=a.cohort_id where a.id=assignment and (
      schools_private.is_founder() or schools_private.is_admin(c.institution_id)
      or schools_private.is_educator(c.id)
      or (a.published_at is not null and schools_private.is_student(c.id))));
$$;
create function schools_private.teaches_institution(institution uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.schools_cohorts c
    where c.institution_id=institution and schools_private.is_educator(c.id));
$$;
create function schools_private.administers_cohort(cohort uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.schools_cohorts c
    where c.id=cohort and schools_private.is_admin(c.institution_id));
$$;
revoke all on all functions in schema schools_private from public, anon;
grant execute on all functions in schema schools_private to authenticated,service_role;

-- Clients can read authorised projections. Writes go through checked transactions.
do $$
declare t text;
begin
  foreach t in array array['staff','institutions','institution_members','cohorts','cohort_educators','cohort_members',
    'question_versions','assignments','assignment_questions','assignment_attempts','feedback_versions','reviews',
    'evidence_corrections','support_requests','audit_log']
  loop
    execute format('alter table public.schools_%I enable row level security',t);
    execute format('revoke all on public.schools_%I from public,anon,authenticated',t);
    execute format('grant all on public.schools_%I to service_role',t);
    execute format('create policy schools_active_session on public.schools_%I as restrictive for select to authenticated using (schools_private.session_active())',t);
  end loop;
end $$;
grant select on public.schools_institutions,public.schools_institution_members,
  public.schools_cohort_educators,public.schools_cohort_members,public.schools_question_versions,
  public.schools_assignments,public.schools_assignment_questions,public.schools_assignment_attempts,
  public.schools_feedback_versions,public.schools_reviews,public.schools_evidence_corrections,
  public.schools_support_requests,public.schools_audit_log to authenticated;
-- The student's cohort projection cannot include enrolment or operational fields.
grant select(id,name) on public.schools_cohorts to authenticated;
create policy schools_institutions_read on public.schools_institutions for select to authenticated using (
  schools_private.is_founder() or schools_private.is_admin(id) or schools_private.teaches_institution(id));
create policy schools_members_read on public.schools_institution_members for select to authenticated using (
  schools_private.is_founder() or schools_private.is_admin(institution_id) or (user_id=auth.uid() and accepted_at is not null));
create policy schools_cohorts_read on public.schools_cohorts for select to authenticated using (
  schools_private.is_founder() or schools_private.is_admin(institution_id)
  or schools_private.is_educator(id) or schools_private.is_student(id));
create policy schools_cohort_educators_read on public.schools_cohort_educators for select to authenticated using (
  schools_private.is_founder() or schools_private.administers_cohort(cohort_id) or schools_private.is_educator(cohort_id));
create policy schools_cohort_members_read on public.schools_cohort_members for select to authenticated using (
  schools_private.is_founder() or schools_private.administers_cohort(cohort_id) or schools_private.is_educator(cohort_id)
  or (student_user_id=auth.uid() and status='active'));
create policy schools_questions_read on public.schools_question_versions for select to authenticated using (
  schools_private.is_founder() or schools_private.is_admin(institution_id) or schools_private.teaches_institution(institution_id) or exists(
    select 1 from public.schools_assignment_questions q where q.question_version_id=id and schools_private.can_read_assignment(q.assignment_id)));
create policy schools_assignments_read on public.schools_assignments for select to authenticated using (
  schools_private.can_read_assignment(id));
create policy schools_assignment_questions_read on public.schools_assignment_questions for select to authenticated using (
  schools_private.can_read_assignment(assignment_id));
create policy schools_attempts_read on public.schools_assignment_attempts for select to authenticated using (
  schools_private.can_read_attempt(id));
create policy schools_feedback_read on public.schools_feedback_versions for select to authenticated using (
  schools_private.can_read_attempt(assignment_attempt_id));
create policy schools_reviews_read on public.schools_reviews for select to authenticated using (
  schools_private.can_read_attempt(assignment_attempt_id));
create policy schools_corrections_read on public.schools_evidence_corrections for select to authenticated using (
  schools_private.can_read_attempt(assignment_attempt_id));
create policy schools_support_read on public.schools_support_requests for select to authenticated using (
  schools_private.is_founder() or schools_private.administers_cohort(cohort_id) or schools_private.is_educator(cohort_id)
  or (student_user_id=auth.uid() and schools_private.is_student(cohort_id)));
create policy schools_audit_read on public.schools_audit_log for select to authenticated using (
  schools_private.is_founder() or schools_private.is_admin(institution_id));

create function schools_private.freeze_question() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Question versions are immutable' using errcode='23514'; end;
$$;
create trigger schools_question_immutable before update on public.schools_question_versions
for each row execute function schools_private.freeze_question();
create function schools_private.freeze_submitted() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='submitted' and (new.answers is distinct from old.answers or new.assignment_id<>old.assignment_id
    or new.student_user_id<>old.student_user_id or new.attempt_number<>old.attempt_number
    or new.status<>old.status or new.submitted_at is distinct from old.submitted_at) then
    raise exception 'Submitted answers are immutable' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger schools_answers_immutable before update on public.schools_assignment_attempts
for each row execute function schools_private.freeze_submitted();
revoke all on function schools_private.freeze_question(),schools_private.freeze_submitted() from public,anon,authenticated;
-- Service-only transactions receive the actor from verified server authentication.
-- Browser clients cannot execute this function or write to the underlying tables.
create function public.schools_write(actor uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  a public.schools_assignments;
  c public.schools_cohorts;
  t public.schools_assignment_attempts;
  r public.schools_reviews;
  previous jsonb;
  result jsonb;
  is_adviser boolean;
  answer jsonb;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if operation in ('draft','submit') then
    select * into a from public.schools_assignments where id=(payload->>'assignmentId')::uuid for update;
    select * into c from public.schools_cohorts where id=a.cohort_id;
    if a.id is null or a.published_at is null or c.archived_at is not null or a.opens_at>now() or a.due_at<=now()
      or not exists(select 1 from public.schools_cohort_members where cohort_id=a.cohort_id and student_user_id=actor and status='active')
      or not exists(select 1 from public.schools_institutions where id=c.institution_id and setup_complete and dpa_complete)
    then raise exception 'Assignment is unavailable' using errcode='42501'; end if;
    if jsonb_typeof(payload->'answers') is distinct from 'array' or jsonb_array_length(payload->'answers')<>3
    then raise exception 'Three answers are required' using errcode='23514'; end if;
    for answer in select value from jsonb_array_elements(payload->'answers') loop
      if jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>12000
        or (operation='submit' and length(trim(answer#>>'{}'))=0)
      then raise exception 'Check your answer text' using errcode='23514'; end if;
    end loop;
    if (select count(*) from public.schools_assignment_questions where assignment_id=a.id)<>3
    then raise exception 'Assignment questions are incomplete' using errcode='23514'; end if;
    -- The browser reserves an opaque identifier before its first request. A lost
    -- response must never turn a repeated submission into a second attempt.
    select * into t from public.schools_assignment_attempts
      where id=(payload->>'attemptId')::uuid and assignment_id=a.id and student_user_id=actor for update;
    if t.id is not null and t.answers=payload->'answers'
      and ((operation='submit' and t.status='submitted') or (operation='draft' and t.status='draft'))
    then return to_jsonb(t); end if;
    select * into t from public.schools_assignment_attempts
      where assignment_id=a.id and student_user_id=actor and status='draft' for update;
    if t.id is null then
      if coalesce((payload->>'revision')::int,0)<>0 then
        -- A retry of a completed submission returns that exact attempt, never creates another.
        select * into t from public.schools_assignment_attempts where id=(payload->>'attemptId')::uuid
          and assignment_id=a.id and student_user_id=actor and status='submitted';
        if operation='submit' and t.id is not null and t.answers=payload->'answers' then return to_jsonb(t); end if;
        raise exception 'This answer changed in another window' using errcode='40001';
      end if;
      insert into public.schools_assignment_attempts(id,assignment_id,student_user_id,attempt_number,answers)
        select coalesce((payload->>'attemptId')::uuid,gen_random_uuid()),a.id,actor,coalesce(max(attempt_number),0)+1,payload->'answers'
        from public.schools_assignment_attempts where assignment_id=a.id and student_user_id=actor returning * into t;
    elsif t.revision<>coalesce((payload->>'revision')::int,-1)
      or t.id is distinct from (payload->>'attemptId')::uuid then
      raise exception 'This answer changed in another window' using errcode='40001';
    end if;
    update public.schools_assignment_attempts set answers=payload->'answers',revision=revision+1,updated_at=now(),
      status=case when operation='submit' then 'submitted' else 'draft' end,
      submitted_at=case when operation='submit' then now() else null end
      where id=t.id returning * into t;
    update public.schools_cohort_members set last_activity_at=now() where cohort_id=c.id and student_user_id=actor;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
      values(actor,case when operation='submit' then 'attempt_submitted' else 'attempt_saved' end,'schools_assignment_attempts',t.id,c.institution_id);
    return to_jsonb(t);
  elsif operation in ('review','undo_review') then
    select * into t from public.schools_assignment_attempts where id=(payload->>'attemptId')::uuid for update;
    select * into a from public.schools_assignments where id=t.assignment_id;
    select * into c from public.schools_cohorts where id=a.cohort_id;
    select exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
      on m.user_id=e.educator_user_id and m.institution_id=c.institution_id
      where e.cohort_id=c.id and e.educator_user_id=actor and m.role='educator' and m.accepted_at is not null) into is_adviser;
    if t.id is null or t.status<>'submitted' or not is_adviser
    then raise exception 'Submitted attempt is unavailable' using errcode='42501'; end if;
    select * into r from public.schools_reviews where assignment_attempt_id=t.id for update;
    if r.id is not null and r.educator_id<>actor then raise exception 'Another adviser owns this review' using errcode='42501'; end if;
    if coalesce(r.revision,0)<>coalesce((payload->>'revision')::int,-1)
    then raise exception 'Review changed in another window' using errcode='40001'; end if;
    if operation='undo_review' then
      if r.id is null or r.undo_expires_at is null or r.undo_expires_at<clock_timestamp()
      then raise exception 'Undo has expired' using errcode='23514'; end if;
      previous=r.previous_review_snapshot;
      if previous is null then
        delete from public.schools_reviews where id=r.id;
        result='null'::jsonb;
      else
        update public.schools_reviews set state=previous->>'state',comment=previous->>'comment',
          created_at=(previous->>'created_at')::timestamptz,updated_at=(previous->>'updated_at')::timestamptz,
          previous_review_snapshot=null,undo_expires_at=null,revision=r.revision+1 where id=r.id returning to_jsonb(schools_reviews.*) into result;
      end if;
    else
      if payload->>'state' not in ('on_track','needs_more','discuss') or payload->>'state' is null
        or length(coalesce(payload->>'comment',''))>280 then raise exception 'Check the review' using errcode='23514'; end if;
      previous=case when r.id is null then null else to_jsonb(r) end;
      insert into public.schools_reviews(assignment_attempt_id,educator_id,state,comment,previous_review_snapshot,undo_expires_at)
        values(t.id,actor,payload->>'state',coalesce(payload->>'comment',''),previous,clock_timestamp()+interval '10 seconds')
        on conflict(assignment_attempt_id) do update set state=excluded.state,comment=excluded.comment,
          previous_review_snapshot=excluded.previous_review_snapshot,undo_expires_at=excluded.undo_expires_at,
          revision=schools_reviews.revision+1,updated_at=now() returning to_jsonb(schools_reviews.*) into result;
    end if;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
      values(actor,case when operation='review' then 'review_saved' else 'review_undone' end,'schools_assignment_attempts',t.id,c.institution_id);
    return result;
  elsif operation='support' then
    select * into c from public.schools_cohorts where id=(payload->>'cohortId')::uuid for update;
    if c.id is null or not exists(select 1 from public.schools_cohort_members
      where cohort_id=c.id and student_user_id=actor and status='active')
    then raise exception 'Cohort unavailable' using errcode='42501'; end if;
    select to_jsonb(s.*) into result from public.schools_support_requests s
      where cohort_id=c.id and student_user_id=actor and status<>'closed' order by created_at limit 1;
    if result is null then
      insert into public.schools_support_requests(cohort_id,student_user_id,created_by)
        values(c.id,actor,'student') returning to_jsonb(schools_support_requests.*) into result;
      insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
        values(actor,'support_requested','schools_support_requests',(result->>'id')::uuid,c.institution_id);
    end if;
    return result;
  end if;
  raise exception 'Unknown schools operation' using errcode='23514';
end;
$$;
revoke all on function public.schools_write(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.schools_write(uuid,text,jsonb) to service_role;
create function schools_private.check_assignment_questions() returns trigger language plpgsql set search_path='' as $$
declare
  cohort_institution uuid;
  question_institution uuid;
  expected_role text;
  actual_role text;
  publication timestamptz;
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.schools_assignments where id=old.assignment_id and published_at is not null)
    then raise exception 'Published questions are immutable' using errcode='23514'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and exists(select 1 from public.schools_assignments where id=old.assignment_id and published_at is not null)
  then raise exception 'Published questions are immutable' using errcode='23514'; end if;
  select c.institution_id,a.role_id,a.published_at into cohort_institution,expected_role,publication
    from public.schools_assignments a join public.schools_cohorts c on c.id=a.cohort_id where a.id=new.assignment_id;
  select institution_id,role_id into question_institution,actual_role from public.schools_question_versions where id=new.question_version_id;
  if publication is not null then raise exception 'Published questions are immutable' using errcode='23514'; end if;
  if cohort_institution is distinct from question_institution or expected_role is distinct from actual_role
  then raise exception 'Question does not belong to this assignment' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger schools_assignment_question_scope before insert or update or delete on public.schools_assignment_questions
for each row execute function schools_private.check_assignment_questions();
create function schools_private.check_publication() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and old.published_at is not null and (new.cohort_id<>old.cohort_id or new.role_id<>old.role_id
    or new.rubric_version_id<>old.rubric_version_id or new.published_at is distinct from old.published_at)
  then raise exception 'Published assignment versions are immutable' using errcode='23514'; end if;
  if new.published_at is not null and (select count(*) from public.schools_assignment_questions where assignment_id=new.id)<>3
  then raise exception 'Approve three questions before publishing' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger schools_assignment_publication before insert or update on public.schools_assignments
for each row execute function schools_private.check_publication();
revoke all on function schools_private.check_assignment_questions(),schools_private.check_publication() from public,anon,authenticated;
alter table public.schools_assignment_attempts add column feedback_claim uuid,
  add column feedback_started_at timestamptz, add column feedback_tries integer not null default 0;
create function public.schools_claim_feedback(attempt uuid, claim uuid) returns jsonb
language sql security invoker set search_path='' as $$
  update public.schools_assignment_attempts set feedback_status='processing',feedback_claim=claim,
    feedback_started_at=now(),feedback_tries=feedback_tries+1
  where id=attempt and status='submitted' and feedback_tries<3
    and (feedback_status in ('pending','failed') or (feedback_status='processing' and feedback_started_at<now()-interval '5 minutes'))
  returning to_jsonb(schools_assignment_attempts.*);
$$;
create function public.schools_store_feedback(attempt uuid,claim uuid,model_name text,contract text,
  feedback jsonb,detail jsonb,input_count integer,output_count integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.schools_assignment_attempts; version_id uuid; covered integer;
begin
  select * into t from public.schools_assignment_attempts where id=attempt for update;
  if t.id is null or t.feedback_claim is distinct from claim or t.feedback_status<>'processing' then return false; end if;
  select count(*) into covered from jsonb_array_elements(detail) q cross join lateral jsonb_array_elements(q->'elements') e where (e->>'present')::boolean;
  insert into public.schools_feedback_versions(assignment_attempt_id,provider,model,contract_version,output,input_tokens,output_tokens)
    values(attempt,'openai',model_name,contract,feedback,input_count,output_count) returning id into version_id;
  update public.schools_assignment_attempts set feedback_status='ready',feedback_version_id=version_id,
    evidence_covered=covered,evidence_detail=detail,feedback_claim=null where id=attempt;
  return true;
end;
$$;
revoke all on function public.schools_claim_feedback(uuid,uuid),public.schools_store_feedback(uuid,uuid,text,text,jsonb,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.schools_claim_feedback(uuid,uuid),public.schools_store_feedback(uuid,uuid,text,text,jsonb,jsonb,integer,integer) to service_role;
create function public.schools_retry(actor uuid,source_attempt uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.schools_assignment_attempts; a public.schools_assignments; draft public.schools_assignment_attempts;
begin
  select * into t from public.schools_assignment_attempts where id=source_attempt and student_user_id=actor and status='submitted';
  select * into a from public.schools_assignments where id=t.assignment_id for update;
  if actor is null or t.id is null or a.due_at<=now() or not exists(select 1 from public.schools_cohort_members m
    join public.schools_cohorts c on c.id=m.cohort_id join public.schools_institutions i on i.id=c.institution_id
    where m.cohort_id=a.cohort_id and m.student_user_id=actor and m.status='active'
    and c.archived_at is null and i.setup_complete and i.dpa_complete)
  then raise exception 'Retry is unavailable' using errcode='42501'; end if;
  select * into draft from public.schools_assignment_attempts where assignment_id=a.id and student_user_id=actor and status='draft';
  if draft.id is null then
    insert into public.schools_assignment_attempts(assignment_id,student_user_id,attempt_number,answers,copied_from_attempt_id)
      select a.id,actor,max(attempt_number)+1,t.answers,t.id from public.schools_assignment_attempts
      where assignment_id=a.id and student_user_id=actor returning * into draft;
  end if;
  return to_jsonb(draft);
end;
$$;
create function public.schools_correct_evidence(actor uuid,attempt uuid,question integer,element text,present boolean,reason_text text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.schools_assignment_attempts; a public.schools_assignments; institution uuid;
  q jsonb; e jsonb; qpos integer; epos integer; original boolean; covered integer;
begin
  select * into t from public.schools_assignment_attempts where id=attempt for update;
  select * into a from public.schools_assignments where id=t.assignment_id;
  select institution_id into institution from public.schools_cohorts where id=a.cohort_id;
  if actor is null or t.id is null or t.status<>'submitted' or t.feedback_status<>'ready' or not exists(
    select 1 from public.schools_cohort_educators ce join public.schools_institution_members im
      on im.user_id=ce.educator_user_id and im.institution_id=institution
    where ce.cohort_id=a.cohort_id and ce.educator_user_id=actor and im.role='educator' and im.accepted_at is not null)
  then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  if present is null or reason_text is null or length(trim(reason_text)) not between 1 and 500 then
    raise exception 'Give a reason for the correction' using errcode='23514'; end if;
  select value,ordinality-1 into q,qpos from jsonb_array_elements(t.evidence_detail) with ordinality where (value->>'questionIndex')::int=question;
  select value,ordinality-1 into e,epos from jsonb_array_elements(q->'elements') with ordinality where value->>'id'=element;
  if e is null then raise exception 'Unknown rubric element' using errcode='23514'; end if;
  original=(e->>'present')::boolean;
  insert into public.schools_evidence_corrections(assignment_attempt_id,educator_id,question_index,rubric_element,original_present,corrected_present,reason)
    values(t.id,actor,question,element,original,present,trim(reason_text));
  t.evidence_detail=jsonb_set(t.evidence_detail,array[qpos::text,'elements',epos::text,'present'],to_jsonb(present));
  select count(*) into covered from jsonb_array_elements(t.evidence_detail) v cross join lateral jsonb_array_elements(v->'elements') item where (item->>'present')::boolean;
  update public.schools_assignment_attempts set evidence_detail=t.evidence_detail,evidence_covered=covered where id=t.id;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,'evidence_corrected','schools_assignment_attempts',t.id,institution);
  return jsonb_build_object('covered',covered,'detail',t.evidence_detail);
end;
$$;
revoke all on function public.schools_retry(uuid,uuid),public.schools_correct_evidence(uuid,uuid,integer,text,boolean,text) from public,anon,authenticated;
grant execute on function public.schools_retry(uuid,uuid),public.schools_correct_evidence(uuid,uuid,integer,text,boolean,text) to service_role;
create function public.schools_manage(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare institution uuid; cohort uuid; founder boolean; administrator boolean; adviser boolean;
  result jsonb; created uuid; item jsonb; position integer; accepted_language text;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select exists(select 1 from public.schools_staff where user_id=actor) into founder;
  if operation='institution' then
    if not founder then raise exception 'Founder access required' using errcode='42501'; end if;
    insert into public.schools_institutions(name,country,language) values(payload->>'name',payload->>'country',payload->>'language')
      returning to_jsonb(schools_institutions.*) into result;
    return result;
  end if;
  institution=(payload->>'institutionId')::uuid;
  cohort=(payload->>'cohortId')::uuid;
  if cohort is not null then select institution_id into institution from public.schools_cohorts where id=cohort; end if;
  select exists(select 1 from public.schools_institution_members where institution_id=institution and user_id=actor
    and role='institution_admin' and accepted_at is not null) into administrator;
  select exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
    on m.institution_id=institution and m.user_id=e.educator_user_id and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=actor) into adviser;
  if operation='approve' then
    if not founder or nullif(trim(payload->>'dpaReference'),'') is null then raise exception 'Founder approval and DPA reference required' using errcode='42501'; end if;
    update public.schools_institutions set dpa_reference=payload->>'dpaReference',dpa_complete=true,setup_complete=true,approved_by=actor,approved_at=now()
      where id=institution returning to_jsonb(schools_institutions.*) into result;
  elsif operation='staff' then
    if not ((founder and payload->>'role'='institution_admin') or (administrator and payload->>'role'='educator'))
    then raise exception 'Institution access required' using errcode='42501'; end if;
    insert into public.schools_institution_members(institution_id,user_id,role,accepted_at)
      values(institution,(payload->>'userId')::uuid,payload->>'role',now()) returning to_jsonb(schools_institution_members.*) into result;
  elsif operation='cohort' then
    if not administrator then raise exception 'Institution admin access required' using errcode='42501'; end if;
    insert into public.schools_cohorts(institution_id,name,enrolment_code,created_by)
      values(institution,payload->>'name',upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),actor)
      returning to_jsonb(schools_cohorts.*) into result;
  elsif operation='assign_educator' then
    if not administrator or not exists(select 1 from public.schools_institution_members where institution_id=institution
      and user_id=(payload->>'userId')::uuid and role='educator' and accepted_at is not null)
    then raise exception 'Accepted institution educator required' using errcode='42501'; end if;
    insert into public.schools_cohort_educators(cohort_id,educator_user_id) values(cohort,(payload->>'userId')::uuid)
      on conflict do nothing;
    result=jsonb_build_object('cohortId',cohort);
  elsif operation='enrolment' then
    if not (administrator or adviser) then raise exception 'Cohort access required' using errcode='42501'; end if;
    if (payload->>'open')::boolean and not exists(select 1 from public.schools_institutions where id=institution and setup_complete and dpa_complete)
    then raise exception 'Institution setup must be complete' using errcode='23514'; end if;
    update public.schools_cohorts set enrolment_open=(payload->>'open')::boolean,
      enrolment_code=case when (payload->>'rotate')::boolean then upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) else enrolment_code end
      where id=cohort and archived_at is null returning to_jsonb(schools_cohorts.*) into result;
  elsif operation='question' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    select language into accepted_language from public.schools_institutions where id=institution;
    insert into public.schools_question_versions(institution_id,question_key,version,role_id,language,question_text,rubric,no_example_follow_up,approved_by)
      values(institution,gen_random_uuid()::text,1,payload->>'roleId',accepted_language,payload->>'text',payload->'rubric',payload->>'followUp',actor)
      returning to_jsonb(schools_question_versions.*) into result;
  elsif operation='assignment' then
    if not adviser then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
    if jsonb_array_length(payload->'questionIds')<>3 then raise exception 'Approve three questions' using errcode='23514'; end if;
    insert into public.schools_assignments(cohort_id,role_id,due_at,created_by)
      values(cohort,payload->>'roleId',(payload->>'dueAt')::timestamptz,actor) returning id into created;
    position=0;
    for item in select value from jsonb_array_elements(payload->'questionIds') loop
      insert into public.schools_assignment_questions(assignment_id,question_index,question_version_id) values(created,position,(item#>>'{}')::uuid);
      position=position+1;
    end loop;
    update public.schools_assignments set published_at=now() where id=created returning to_jsonb(schools_assignments.*) into result;
  else raise exception 'Unknown operation' using errcode='23514';
  end if;
  if result is null then raise exception 'Record unavailable' using errcode='42501'; end if;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,operation,'schools_management',coalesce(created,cohort,institution),institution);
  return result;
end;
$$;
revoke all on function public.schools_manage(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.schools_manage(uuid,text,jsonb) to service_role;
create function public.schools_adviser_support(actor uuid,cohort uuid,student uuid,new_status text,note_text text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare institution uuid; request public.schools_support_requests;
begin
  select institution_id into institution from public.schools_cohorts where id=cohort for update;
  if not exists(select 1 from public.schools_cohort_educators e join public.schools_institution_members m
    on m.user_id=e.educator_user_id and m.institution_id=institution and m.role='educator' and m.accepted_at is not null
    where e.cohort_id=cohort and e.educator_user_id=actor)
    or not exists(select 1 from public.schools_cohort_members where cohort_id=cohort and student_user_id=student and status='active')
  then raise exception 'Assigned adviser access required' using errcode='42501'; end if;
  if new_status not in ('open','scheduled','closed') or new_status is null or length(coalesce(note_text,''))>1000
  then raise exception 'Check the support request' using errcode='23514'; end if;
  select * into request from public.schools_support_requests where cohort_id=cohort and student_user_id=student
    and status<>'closed' order by created_at limit 1 for update;
  if request.id is null then
    if new_status<>'open' then raise exception 'Open a support request first' using errcode='23514'; end if;
    insert into public.schools_support_requests(cohort_id,student_user_id,created_by,owner_educator_id,note)
      values(cohort,student,'educator',actor,coalesce(note_text,'')) returning * into request;
  else
    if request.owner_educator_id is not null and request.owner_educator_id<>actor
    then raise exception 'Another adviser owns this request' using errcode='42501'; end if;
    update public.schools_support_requests set owner_educator_id=actor,status=new_status,note=coalesce(note_text,''),updated_at=now()
      where id=request.id returning * into request;
  end if;
  insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
    values(actor,'support_updated','schools_support_requests',request.id,institution);
  return to_jsonb(request);
end;
$$;
revoke all on function public.schools_adviser_support(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.schools_adviser_support(uuid,uuid,uuid,text,text) to service_role;
create function public.schools_mark_read(actor uuid,attempt uuid,feedback boolean,review_revision integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare target public.schools_assignment_attempts; institution uuid;
begin
  select t.* into target from public.schools_assignment_attempts t join public.schools_assignments a on a.id=t.assignment_id
    join public.schools_cohort_members m on m.cohort_id=a.cohort_id and m.student_user_id=actor and m.status='active'
    where t.id=attempt and t.student_user_id=actor and t.status='submitted' for update of t;
  if target.id is null then raise exception 'Own submitted work required' using errcode='42501'; end if;
  select c.institution_id into institution from public.schools_assignments a join public.schools_cohorts c on c.id=a.cohort_id where a.id=target.assignment_id;
  if feedback and target.feedback_status='ready' and target.feedback_opened_at is null then
    update public.schools_assignment_attempts set feedback_opened_at=now() where id=target.id;
    insert into public.schools_audit_log(actor_user_id,action,target_table,target_id,institution_id)
      values(actor,'feedback_opened','schools_assignment_attempts',target.id,institution);
  end if;
  if review_revision is not null and exists(select 1 from public.schools_reviews where assignment_attempt_id=target.id and revision=review_revision) then
    update public.schools_assignment_attempts set comment_read_revision=review_revision where id=target.id;
  end if;
  return true;
end;
$$;
revoke all on function public.schools_mark_read(uuid,uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.schools_mark_read(uuid,uuid,boolean,integer) to service_role;
commit;
