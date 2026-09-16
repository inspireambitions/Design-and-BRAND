import { redirect } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';

export default async function SchoolsHomePage() {
  const { client, user } = await schoolsContext();
  // Read only the signed-in user's accepted memberships through existing RLS.
  // A sign-in query parameter never grants a role or changes membership.
  const memberships = await client.from('schools_institution_members')
    .select('role').eq('user_id', user.id).not('accepted_at', 'is', null);
  if (memberships.error) throw new Error('Could not load your school access');
  if (memberships.data?.some(member => member.role === 'institution_admin')) redirect('/schools/admin');
  if (memberships.data?.some(member => member.role === 'educator')) redirect('/schools/cohorts');
  const students = await client.from('schools_cohort_members')
    .select('cohort_id').eq('student_user_id', user.id).eq('status', 'active').limit(1);
  if (students.error) throw new Error('Could not load your student access');
  redirect(students.data?.length ? '/schools/me' : '/schools/access');
}
