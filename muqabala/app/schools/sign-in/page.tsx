import Link from 'next/link';
import { EmailSignIn } from '@/components/EmailSignIn';
import { requireSchoolsEnabled } from '@/lib/schools/access';
export default async function SchoolsSignInPage({ searchParams }: { searchParams: Promise<{ role?: string | string[] }> }) {
  requireSchoolsEnabled();
  const role = (await searchParams).role;
  const student = role === 'student';
  const educator = role === 'educator';
  return <><h1>{student ? 'Student email sign-in' : educator ? 'Educator and administrator sign-in' : 'Sign in to your school workspace'}</h1>
    <p>{student ? 'Use the email your institution enrolled for student assignments.' : 'Use the email your institution invited. After signing in, we open the workspace your accepted access allows.'}</p>
    <p>Signing in does not create institution access or enrol you in a cohort. Educators and administrators must first accept their staff invitation using its original link.</p>
    <EmailSignIn key={student ? 'student' : 'staff'} next={student ? '/schools/me' : '/schools/home'} compact/>
    <p><Link href="/schools/access">Choose educator or student access</Link></p>
    <p><Link href="/schools/enrol">Use a student private link or recovery code</Link></p></>;
}
