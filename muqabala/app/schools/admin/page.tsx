import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsManagementForm } from '@/components/schools/ManagementForm';
import { SchoolsStaffInvite } from '@/components/schools/StaffInvitation';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSchoolsInstitutionSummary } from '@/lib/schools/dashboard';
import { loadSchoolsAdminParticipation } from '@/lib/schools/admin-participation';

const date = (value: string) => new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function InstitutionAdmin() {
  const { client, user } = await schoolsContext();
  const membershipsResult = await client.from('schools_institution_members')
    .select('institution_id')
    .eq('user_id', user.id)
    .eq('role', 'institution_admin')
    .not('accepted_at', 'is', null);
  if (membershipsResult.error || !membershipsResult.data?.length) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();
  const ownIds = membershipsResult.data.map((membership) => membership.institution_id);
  const [participation, educatorsResult, institutionsResult] = await Promise.all([
    loadSchoolsAdminParticipation({
      acceptedInstitutionIds: ownIds,
      source: {
        cohorts: async (institutionIds) => {
          const result = await admin.from('schools_cohorts').select('id,name,institution_id,archived_at').in('institution_id', institutionIds);
          if (result.error) throw new Error('Could not load institution cohorts');
          return result.data;
        },
        members: async (cohortIds) => {
          const result = await client.from('schools_cohort_members').select('cohort_id,student_user_id,status').in('cohort_id', cohortIds);
          if (result.error) throw new Error('Could not load institution members');
          return result.data;
        },
        assignments: async (cohortIds) => {
          const result = await client.from('schools_assignments').select('id,cohort_id,role_id,opens_at,due_at,published_at,created_at').in('cohort_id', cohortIds).not('published_at', 'is', null);
          if (result.error) throw new Error('Could not load institution assignments');
          return result.data;
        },
        support: async (cohortIds) => {
          const result = await client.from('schools_support_requests').select('cohort_id,status').in('cohort_id', cohortIds);
          if (result.error) throw new Error('Could not load institution support');
          return result.data;
        },
        submittedAttempts: async (assignmentIds) => {
          const result = await admin.from('schools_assignment_attempts')
            .select('id,assignment_id,student_user_id,attempt_number,submitted_at')
            .in('assignment_id', assignmentIds)
            .eq('status', 'submitted');
          if (result.error) throw new Error('Could not load submitted work');
          return result.data;
        },
        reviews: async (attemptIds) => {
          const result = await admin.from('schools_reviews').select('assignment_attempt_id').in('assignment_attempt_id', attemptIds);
          if (result.error) throw new Error('Could not load review progress');
          return result.data;
        },
      },
    }),
    client.from('schools_institution_members').select('user_id,institution_id').eq('role', 'educator').not('accepted_at', 'is', null).in('institution_id', ownIds),
    client.from('schools_institutions').select('id,name,country,language,setup_complete').in('id', ownIds),
  ]);
  if (!participation || educatorsResult.error || institutionsResult.error) {
    throw new Error('Could not load institution details');
  }
  const { cohorts, members, assignments, support, attempts, reviews } = participation;

  const educatorIdentities = await Promise.all(educatorsResult.data.map(async (educator) => {
    const identity = await admin.auth.admin.getUserById(educator.user_id);
    return [educator.user_id, identity.data.user?.email ?? 'Email unavailable'] as const;
  }));
  const educatorLabels = new Map(educatorIdentities);

  return <>
    <header className="schools-page-heading">
      <p className="schools-eyebrow">Institution administration</p>
      <h1>Your institution</h1>
      <p>Monitor participation without opening student answers or private drafts.</p>
    </header>
    {institutionsResult.data.map((institution) => {
      const summary = buildSchoolsInstitutionSummary({
        institutionId: institution.id,
        cohorts,
        members,
        assignments,
        attempts,
        reviews,
        support,
      });
      const institutionCohorts = cohorts.filter((cohort) => cohort.institution_id === institution.id);
      return <section className="schools-institution" key={institution.id}>
        <div className="schools-card schools-overview-card">
          <div className="schools-dashboard-card-heading">
            <div>
              <p className="schools-eyebrow">Participation overview</p>
              <h2>{institution.name}</h2>
              <p>{institution.country}. Teaching language: {institution.language === 'en' ? 'English' : 'Arabic'}.</p>
            </div>
            <span className="schools-state">{institution.setup_complete ? 'Setup complete' : 'Setup required'}</span>
          </div>
          <dl className="schools-metric-grid schools-admin-metrics">
            <div><dt>Active cohorts</dt><dd>{summary.activeCohorts}</dd></div>
            <div><dt>Enrolled students</dt><dd>{summary.enrolledStudents}</dd></div>
            <div><dt>Submitted</dt><dd>{summary.submitted}</dd></div>
            <div><dt>Not submitted</dt><dd>{summary.notSubmitted}</dd></div>
            <div><dt>Awaiting review</dt><dd>{summary.awaitingReview}</dd></div>
            <div><dt>Open support</dt><dd>{summary.openSupport}</dd></div>
          </dl>
          <section aria-labelledby={`active-assignments-${institution.id}`}>
            <h3 id={`active-assignments-${institution.id}`}>Next active assignment per cohort</h3>
            {!summary.activeAssignments.length && <p>No active assignments.</p>}
            {!!summary.activeAssignments.length && <ul className="schools-assignment-list">
              {summary.activeAssignments.map((assignment) => <li key={assignment.id}>
                <span><strong>{assignment.roleId}</strong><small>{institutionCohorts.find((cohort) => cohort.id === assignment.cohortId)?.name}</small></span>
                <span>Due {date(assignment.dueAt)}</span>
              </li>)}
            </ul>}
          </section>
          <p className="schools-privacy-note">This overview counts participation only. It does not show drafts, answers, feedback or adviser comments.</p>
        </div>

        <div className="schools-card">
          <h2>Manage {institution.name}</h2>
          <p>{institution.setup_complete ? 'Institution setup is complete.' : 'Muqabala must complete setup before enrolment opens.'}</p>
          <SchoolsStaffInvite institutionId={institution.id} />
          <SchoolsManagementForm operation="institution_details" fixed={{ institutionId: institution.id }} button="Update institution details" fields={[
            { name: 'name', label: 'Institution name', value: institution.name },
            { name: 'country', label: 'Country', value: institution.country },
          ]} />
          <SchoolsManagementForm operation="cohort" fixed={{ institutionId: institution.id }} button="Create cohort" fields={[{ name: 'name', label: 'Cohort name' }]} />
          {institutionCohorts.map((cohort) => <section className="schools-management-row" key={cohort.id}>
            <h3>{cohort.name}</h3>
            <p>{members.filter((member) => member.cohort_id === cohort.id && member.status === 'active').length} active students.</p>
            <SchoolsManagementForm operation="assign_educator" fixed={{ cohortId: cohort.id }} button="Assign educator" fields={[{
              name: 'userId',
              label: 'Accepted educator account',
              options: educatorsResult.data
                .filter((educator) => educator.institution_id === institution.id)
                .map((educator) => ({ value: educator.user_id, label: educatorLabels.get(educator.user_id)! })),
            }]} />
          </section>)}
        </div>
      </section>;
    })}
  </>;
}
