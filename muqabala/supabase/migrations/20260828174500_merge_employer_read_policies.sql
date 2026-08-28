set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists "Candidates can read their interviews" on public.interviews;
drop policy if exists "Employers can read submitted interviews" on public.interviews;
create policy "Candidates or employers can read permitted interviews"
on public.interviews for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    submitted_at is not null
    and exists (
      select 1
      from public.screening_packs
      where screening_packs.id = interviews.screening_pack_id
        and screening_packs.employer_id = (select auth.uid())
    )
  )
);

drop policy if exists "Candidates can read their answers" on public.interview_answers;
drop policy if exists "Employers can read submitted answers" on public.interview_answers;
create policy "Candidates or employers can read permitted answers"
on public.interview_answers for select
to authenticated
using (
  exists (
    select 1
    from public.interviews
    left join public.screening_packs on screening_packs.id = interviews.screening_pack_id
    where interviews.id = interview_answers.interview_id
      and (
        interviews.user_id = (select auth.uid())
        or (
          interviews.submitted_at is not null
          and screening_packs.employer_id = (select auth.uid())
        )
      )
  )
);
