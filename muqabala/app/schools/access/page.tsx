import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';

export default function SchoolsAccessPage() {
  requireSchoolsEnabled();
  return <>
    <h1>Access your school workspace</h1>
    <p>Choose the access your institution gave you. A student private link provides student access only.</p>
    <section className="schools-card" aria-labelledby="educator-access">
      <h2 id="educator-access">Educators and administrators</h2>
      <p>First time here? Open the staff invitation sent to your email and accept it. Then sign in using that same email to reach your assigned cohorts or institution workspace.</p>
      <Link className="schools-button" href="/schools/sign-in?role=educator">Educator or administrator sign-in</Link>
      <p>If you have only a learner link, ask your institution administrator for a staff invitation. Signing in cannot change your role.</p>
    </section>
    <section id="student-access" className="schools-card" aria-labelledby="student-access-title">
      <h2 id="student-access-title">Students</h2>
      <p>Open the private link your adviser gave you, or enter your recovery code. If your institution enrolled you by email, use student email sign-in.</p>
      <div className="schools-actions"><Link className="schools-button" href="/schools/enrol">Use a student private link or recovery code</Link><Link href="/schools/sign-in?role=student">Student email sign-in</Link></div>
    </section>
    <p>Missing an invitation or waiting for a cohort? Contact your institution administrator or adviser.</p>
    <p><Link href="/schools#start-pilot">Enquire about a school pilot</Link> if your institution is exploring a new pilot. An enquiry does not grant access.</p>
  </>;
}
