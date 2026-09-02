import { ImageResponse } from 'next/og';
import { employerVolumeEnabled } from '@/lib/employer-volume';
import { timeSavedHours } from '@/lib/employer-volume/strip';
import { loadRoleStrip } from '@/lib/server/employer-role-strip';
import { verifyInterview } from '@/lib/interview-token';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 1080 x 1350 share image: role title, five numbers, time saved, Muqabala mark.
 * No names, no contact details. Rendered server-side for the owning employer.
 */
export async function GET(_request: Request, context: { params: Promise<{ roleId: string }> }) {
  if (!employerVolumeEnabled()) return Response.json({ error: 'Not available.' }, { status: 404 });
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ configured: false }, { status: 503 });

  const { roleId } = await context.params;
  const { data: pack } = await client.from('screening_packs').select('id,workplace,signed_token,minutes_per_cv,employer_id').eq('id', roleId).maybeSingle();
  if (!pack || pack.employer_id !== user.id) return Response.json({ error: 'Role not found.' }, { status: 404 });
  const roleTitle = verifyInterview(pack.signed_token)?.title ?? 'Role';
  const { strip } = await loadRoleStrip(client, pack.id);
  const hours = timeSavedHours(strip, typeof pack.minutes_per_cv === 'number' ? pack.minutes_per_cv : 4);
  await admin.from('export_log').insert({ employer_id: user.id, role_id: pack.id, format: 'summary_png' });

  const numbers: [string, number][] = [
    ['Invited', strip.invited],
    ['Answered', strip.answered],
    ['Full coverage', strip.fullCoverage],
    ['Shortlisted', strip.shortlisted],
    ['Decided', strip.decided],
  ];

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 88, background: '#f7f6f2', color: '#16241f', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: '#07564b', fontWeight: 700 }}>SHORTLIST SUMMARY</div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, marginTop: 24, letterSpacing: -2 }}>{roleTitle}</div>
          <div style={{ fontSize: 34, color: '#536860', marginTop: 16 }}>{pack.workplace || 'Hiring team'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {numbers.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '3px solid #d5ded8', paddingBottom: 18 }}>
              <div style={{ fontSize: 40, color: '#536860' }}>{label}</div>
              <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>{value}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
            <div style={{ fontSize: 40, color: '#536860' }}>Time saved</div>
            <div style={{ fontSize: 64, fontWeight: 800, color: '#07564b' }}>{hours.toFixed(1)} hours</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: '#0b7a6b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40, fontWeight: 800 }}>M</div>
            <div style={{ fontSize: 40, fontWeight: 800 }}>Muqabala</div>
          </div>
          <div style={{ fontSize: 26, color: '#536860' }}>Every decision made by a person</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline; filename="muqabala-summary.png"' } },
  );
}
