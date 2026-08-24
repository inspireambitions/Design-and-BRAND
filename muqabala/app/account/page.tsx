import { redirect } from 'next/navigation';
import { AccountInterviews, type AccountInterview } from '@/components/AccountInterviews';
import { SignOutButton } from '@/components/SignOutButton';
import { TopBar } from '@/components/TopBar';
import { AccountTitle } from '@/components/AccountTitle';
import { createClient, currentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account');
  const client = await createClient();
  const { data } = await client!.from('interviews')
    .select('id,role_id,role_title,status,current_question,saved,updated_at')
    .eq('user_id', user.id)
    .or(`saved.eq.true,expires_at.gt.${new Date().toISOString()}`)
    .order('updated_at', { ascending: false });

  return (
    <main className="shell shell-narrow">
      <TopBar showProgressLink={false} />
      <div className="stack-lg">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <AccountTitle />
          <SignOutButton />
        </div>
        <AccountInterviews interviews={(data ?? []) as AccountInterview[]} />
      </div>
    </main>
  );
}
