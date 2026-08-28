import { redirect } from 'next/navigation';
import { AccountInterviews, type AccountInterview } from '@/components/AccountInterviews';
import { AccountDashboard } from '@/components/AccountDashboard';
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
    <AccountDashboard
      email={user.email ?? ''}
      interviews={(data ?? []) as AccountInterview[]}
    />
  );
}
