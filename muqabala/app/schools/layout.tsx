import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
import { SchoolsSignOut } from '@/components/schools/SignOut';
import './schools.css';
export const dynamic='force-dynamic';
export const metadata={
  title:'Muqabala for Schools and Colleges',
  description:'Interview practice for every student. Evidence for every adviser.',
  robots:{index:false,follow:false},
  openGraph:{title:'Muqabala for Schools and Colleges',description:'Interview practice for every student. Evidence for every adviser.',url:'https://trymuqabala.com/schools'},
};
export default function SchoolsLayout({children}:{children:React.ReactNode}) {
  requireSchoolsEnabled();
  return <div className="schools-shell"><a className="schools-skip" href="#schools-main">Skip to content</a>
    <header className="schools-header"><Link href="/schools">Muqabala <span>Schools and Colleges</span></Link>
      <nav aria-label="Schools"><Link href="/schools/me">My assignments</Link><Link href="/schools/cohorts">Cohorts</Link><Link href="/schools/me/settings">Account</Link><SchoolsSignOut/></nav>
    </header><main id="schools-main">{children}</main>
    <footer>Private interview practice. Your adviser can read what you submit. Drafts are private.</footer></div>;
}
