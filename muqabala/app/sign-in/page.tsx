import { EmailSignIn } from '@/components/EmailSignIn';
import { TopBar } from '@/components/TopBar';
import { safeNext } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  return (
    <main className="shell shell-narrow">
      <TopBar />
      <EmailSignIn next={safeNext(query.next, '/account')} />
    </main>
  );
}
