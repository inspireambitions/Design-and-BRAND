import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
import { SchoolsNavigation } from '@/components/schools/Navigation';
import './schools.css';
import {pagePreviewMetadata} from '@/lib/link-previews';
export const dynamic='force-dynamic';
export const metadata={
  ...pagePreviewMetadata('schools'),
  robots:{index:false,follow:false},
};
export default async function SchoolsLayout({children}:{children:React.ReactNode}) {
  requireSchoolsEnabled();
  const client=await createClient();
  const identity=client?await client.auth.getUser():null;
  const user = identity?.data.user;
  let canViewCohorts = false;
  if (user && client) {
    const [assigned, memberships] = await Promise.all([
      client.from('schools_cohort_educators').select('cohort_id').eq('educator_user_id', user.id).limit(1),
      client.from('schools_institution_members').select('id').eq('user_id', user.id).eq('role', 'institution_admin').not('accepted_at', 'is', null).limit(1),
    ]);
    canViewCohorts = !!assigned?.data?.length || !!memberships?.data?.length;
  }
  return <div className="schools-shell"><a className="schools-skip" href="#schools-main">Skip to content</a>
    <header className="schools-header"><div className="schools-brand"><Link href="/">Muqabala</Link><p>Higher Education &amp; Career Centres</p></div>
      <SchoolsNavigation canViewCohorts={canViewCohorts} userId={user?.id}/>
    </header><main id="schools-main">{children}</main>
    <footer><p className="schools-footer-brand">Muqabala by <a href="https://inspireambitions.com/">Inspire Ambitions</a></p>
      <nav aria-label="Institutional footer"><Link href="/privacy">Privacy</Link><Link href="/accessibility">Accessibility</Link><Link href="/practice">For candidates</Link><Link href="/for-employers">For hiring teams</Link></nav>
      <p>Institutional career-readiness platform. Private interview practice with adviser-in-the-loop development.</p></footer></div>;
}
