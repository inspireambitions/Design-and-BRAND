import { EmailSignIn } from '@/components/EmailSignIn';
import { requireSchoolsEnabled } from '@/lib/schools/access';
export default function SchoolsSignInPage() {
  requireSchoolsEnabled();
  return <><h1>Sign in to your institution</h1><p>Use the email your institution enrolled. Signing in does not enrol you in a cohort.</p>
    <EmailSignIn next="/schools/me"/></>;
}
