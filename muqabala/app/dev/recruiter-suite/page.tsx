import { notFound } from 'next/navigation';
import { RecruiterSuiteFixture } from '@/components/RecruiterSuiteFixture';

export const metadata = { title: 'Recruiter suite review fixture', robots: { index: false, follow: false } };

export default async function RecruiterSuiteFixturePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const state = query.state === 'empty' || query.state === 'error' ? query.state : 'populated';
  return <RecruiterSuiteFixture state={state} />;
}
