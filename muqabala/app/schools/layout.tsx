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
export default function SchoolsLayout({children}:{children:React.ReactNode}) {
  requireSchoolsEnabled();
  return <div className="schools-shell"><a className="schools-skip" href="#schools-main">Skip to content</a>
    <header className="schools-header"><div className="schools-brand"><Link href="/">Muqabala</Link><p>Schools and Colleges</p></div>
      <SchoolsNavigation/>
    </header><main id="schools-main">{children}</main>
    <footer><p className="schools-footer-brand">Muqabala by <a href="https://inspireambitions.com/">Inspire Ambitions</a></p>
      <nav aria-label="Schools footer"><Link href="/privacy">Privacy</Link><Link href="/accessibility">Accessibility</Link><Link href="/practice">For candidates</Link><Link href="/for-employers">For hiring teams</Link></nav>
      <p>Private interview practice. Your adviser can read what you submit. Drafts are private.</p></footer></div>;
}
