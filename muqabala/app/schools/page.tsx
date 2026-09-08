import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
export default function SchoolsPage() {
  requireSchoolsEnabled();
  return <><p>Muqabala for Schools and Colleges</p><h1>Interview practice for every student. Evidence for every adviser.</h1>
    <p>Assign three role-relevant questions to a class. Students practise in private and improve on retry. You review and comment.</p>
    <div className="schools-card"><h2>A controlled institution pilot</h2><p>Enrolment opens after your institution completes setup and its data processing arrangement.</p>
    <Link className="schools-button" href="/schools/sign-in">Sign in</Link></div></>;
}
