import { schoolsContext } from '@/lib/schools/server';
import { SchoolsSignOut } from '@/components/schools/SignOut';
import Link from 'next/link';
export default async function SchoolsSettings() {
  const { user } = await schoolsContext();
  return (
    <div style={{ maxWidth: '640px', margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: '8px' }}>Your account</h1>
      <p style={{ color: '#4a5568', marginBottom: '24px' }}>Manage your session security and institutional privacy options.</p>

      <section className="schools-card" style={{ marginBottom: '24px' }}>
        <h2>Active session</h2>
        <p style={{ color: '#4a5568', fontSize: '14px' }}>
          Close your session across shared university computers and devices when you finish.
        </p>
        <div style={{ marginTop: '16px' }}>
          <SchoolsSignOut everywhere studentUserId={user.id} />
        </div>
      </section>

      <section className="schools-card" style={{ border: '1px solid #e2e8f0' }}>
        <h2>Privacy &amp; institutional data</h2>
        <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: 1.5 }}>
          Your institutional records are kept strictly confidential for your university programme and adviser review.
          If you wish to remove your assignment submissions, feedback, and student history from this institution:
        </p>
        <div style={{ marginTop: '16px' }}>
          <Link
            href="/schools/me/delete"
            style={{
              display: 'inline-block',
              color: '#c53030',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'underline',
            }}
          >
            Manage deletion of your schools data &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
