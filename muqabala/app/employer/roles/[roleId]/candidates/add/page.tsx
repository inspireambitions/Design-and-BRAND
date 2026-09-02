import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AddCandidates } from '@/components/AddCandidates';
import { employerVolumeFlags } from '@/lib/employer-volume';
import { verifyInterview } from '@/lib/interview-token';
import { createClient, currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Add candidates',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AddCandidatesPage({ params }: { params: Promise<{ roleId: string }> }) {
  const flags = employerVolumeFlags();
  if (!flags.volume) notFound();

  const { roleId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/employer/roles/${roleId}/candidates/add`)}`);

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: pack } = await supabase
    .from('screening_packs')
    .select('id,public_code,workplace,signed_token,expires_at')
    .eq('id', roleId)
    .maybeSingle();
  if (!pack) notFound();

  const roleTitle = verifyInterview(pack.signed_token)?.title ?? 'Role work sample';

  return (
    <AddCandidates
      roleId={pack.id}
      roleTitle={roleTitle}
      workplace={pack.workplace}
      closed={new Date(pack.expires_at).getTime() <= Date.now()}
      whatsApp={flags.whatsApp}
    />
  );
}
