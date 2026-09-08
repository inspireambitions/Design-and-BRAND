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
    <header className="schools-header"><Link href="/schools">Muqabala <span>Schools and Colleges</span></Link>
      <SchoolsNavigation/>
    </header><main id="schools-main">{children}</main>
    <footer>Private interview practice. Your adviser can read what you submit. Drafts are private.</footer></div>;
}
