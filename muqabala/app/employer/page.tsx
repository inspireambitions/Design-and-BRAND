import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/SignOutButton';
import { configuredOrigin } from '@/lib/server/security';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from './EmployerDashboard.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pack = {
  id: string;
  public_code: string;
  workplace: string;
  created_at: string;
  expires_at: string;
};

type Submission = {
  id: string;
  screening_pack_id: string;
  candidate_name: string | null;
  role_title: string;
  submitted_at: string;
};

export default async function EmployerDashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/employer');
  const client = await createClient();
  const { data: packRows } = await client!.from('screening_packs')
    .select('id,public_code,workplace,created_at,expires_at')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false });
  const packs = (packRows ?? []) as Pack[];
  const ids = packs.map((pack) => pack.id);
  const { data: interviewRows } = ids.length
    ? await client!.from('interviews')
        .select('id,screening_pack_id,candidate_name,role_title,submitted_at')
        .in('screening_pack_id', ids)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
    : { data: [] };
  const submissions = (interviewRows ?? []) as Submission[];
  const origin = configuredOrigin();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Muqabala</Link>
        <nav aria-label="Employer navigation">
          <Link href="/for-employers">Create interview link</Link>
          <SignOutButton />
        </nav>
      </header>
      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Employer dashboard</p>
          <h1>Submitted interviews</h1>
          <p>Only interviews submitted with candidate consent appear here. Open a report to review the recorded evidence and clearly labelled AI analysis.</p>
        </section>

        <div className={styles.packs}>
          {packs.length === 0 && (
            <section className={styles.pack}>
              <p className={styles.empty}>You have not created an employer interview link yet.</p>
            </section>
          )}
          {packs.map((pack) => {
            const candidates = submissions.filter((item) => item.screening_pack_id === pack.id);
            return (
              <section className={styles.pack} key={pack.id}>
                <div className={styles.packHead}>
                  <div>
                    <h2>{pack.workplace || 'Employer interview'}</h2>
                    <p>Created {new Date(pack.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  <a className={styles.share} href={`${origin}/s/${pack.public_code}`}>{origin}/s/{pack.public_code}</a>
                </div>
                {candidates.length === 0 ? (
                  <p className={styles.empty}>No submitted interviews yet.</p>
                ) : (
                  <ul className={styles.candidateList}>
                    {candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <Link className={styles.candidateLink} href={`/employer/interviews/${candidate.id}`}>
                          <strong>{candidate.candidate_name || 'Candidate'}</strong>
                          <span className={styles.meta}>{candidate.role_title} · {new Date(candidate.submitted_at).toLocaleString('en-GB')}</span>
                          <span className={styles.status}>Submitted</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
