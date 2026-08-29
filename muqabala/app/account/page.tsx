import { redirect } from 'next/navigation';
import { AccountInterviews, type AccountInterview } from '@/components/AccountInterviews';
import { AccountDashboard } from '@/components/AccountDashboard';
import { createClient, currentUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account');
  const client = await createClient();
  const admin = createAdminClient();
  const { data } = await client!.from('interviews')
    .select('id,role_id,role_title,status,current_question,saved,updated_at')
    .eq('user_id', user.id)
    .or(`saved.eq.true,expires_at.gt.${new Date().toISOString()}`)
    .order('updated_at', { ascending: false });
  const { data: emailPreference } = admin
    ? await admin.from('lifecycle_email_preferences').select('marketing_opt_in').eq('user_id', user.id).maybeSingle()
    : { data: null };

  return (
    <AccountDashboard
      email={user.email ?? ''}
      interviews={(data ?? []) as AccountInterview[]}
      marketingOptIn={emailPreference?.marketing_opt_in === true}
    />
  );
}
