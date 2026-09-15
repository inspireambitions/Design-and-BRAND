begin;

-- The dashboards, deletion worker and RLS helpers join through these foreign keys.
-- Cover every previously unindexed Schools foreign key so relationship checks do
-- not degrade into table scans as the pilot grows.
create index if not exists schools_attempts_copied_from_idx on public.schools_assignment_attempts(copied_from_attempt_id);
create index if not exists schools_attempts_student_idx on public.schools_assignment_attempts(student_user_id);
create index if not exists schools_attempts_feedback_idx on public.schools_assignment_attempts(feedback_version_id);
create index if not exists schools_assignment_questions_version_idx on public.schools_assignment_questions(question_version_id);
create index if not exists schools_assignments_cohort_idx on public.schools_assignments(cohort_id);
create index if not exists schools_assignments_creator_idx on public.schools_assignments(created_by);
create index if not exists schools_audit_institution_idx on public.schools_audit_log(institution_id);
create index if not exists schools_cohorts_creator_idx on public.schools_cohorts(created_by);
create index if not exists schools_corrections_attempt_idx on public.schools_evidence_corrections(assignment_attempt_id);
create index if not exists schools_corrections_educator_idx on public.schools_evidence_corrections(educator_id);
create index if not exists schools_feedback_attempt_idx on public.schools_feedback_versions(assignment_attempt_id);
create index if not exists schools_institutions_approver_idx on public.schools_institutions(approved_by);
create index if not exists schools_questions_approver_idx on public.schools_question_versions(approved_by);
create index if not exists schools_reviews_educator_idx on public.schools_reviews(educator_id);
create index if not exists schools_support_owner_idx on public.schools_support_requests(owner_educator_id);
create index if not exists schools_support_student_idx on public.schools_support_requests(student_user_id);

create index if not exists schools_access_grants_cohort_idx on schools_private.access_grants(cohort_id);
create index if not exists schools_access_grants_issuer_idx on schools_private.access_grants(issuer_id);
create index if not exists schools_access_grants_student_idx on schools_private.access_grants(student_user_id);
create index if not exists schools_events_cohort_idx on schools_private.events(cohort_id);
create index if not exists schools_events_institution_idx on schools_private.events(institution_id);
create index if not exists schools_feedback_usage_cohort_idx on schools_private.feedback_usage(cohort_id);
create index if not exists schools_feedback_usage_institution_idx on schools_private.feedback_usage(institution_id);
create index if not exists schools_mail_institution_idx on schools_private.mail_outbox(institution_id);
create index if not exists schools_privacy_receipts_verifier_idx on schools_private.privacy_receipts(verified_by);
create index if not exists schools_review_sessions_educator_idx on schools_private.review_sessions(educator_id);
create index if not exists schools_staff_invites_institution_idx on schools_private.staff_invites(institution_id);
create index if not exists schools_staff_invites_issuer_idx on schools_private.staff_invites(issuer_id);

-- Cache auth.uid() once per statement. The predicates and access rules are
-- unchanged; only the evaluation plan changes.
drop policy if exists schools_members_read on public.schools_institution_members;
create policy schools_members_read on public.schools_institution_members
for select to authenticated using (
  schools_private.is_founder()
  or schools_private.is_admin(institution_id)
  or (user_id=(select auth.uid()) and accepted_at is not null)
);

drop policy if exists schools_cohort_members_read on public.schools_cohort_members;
create policy schools_cohort_members_read on public.schools_cohort_members
for select to authenticated using (
  schools_private.is_founder()
  or schools_private.administers_cohort(cohort_id)
  or schools_private.is_educator(cohort_id)
  or (student_user_id=(select auth.uid()) and status='active')
);

drop policy if exists schools_support_read on public.schools_support_requests;
create policy schools_support_read on public.schools_support_requests
for select to authenticated using (
  schools_private.is_founder()
  or schools_private.administers_cohort(cohort_id)
  or schools_private.is_educator(cohort_id)
  or (student_user_id=(select auth.uid()) and schools_private.is_student(cohort_id))
);

commit;
