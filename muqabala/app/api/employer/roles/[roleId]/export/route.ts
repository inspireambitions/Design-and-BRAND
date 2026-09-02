import { employerVolumeEnabled } from '@/lib/employer-volume';
import { buildPdf, type PdfLine } from '@/lib/employer-volume/pdf';
import { exportCsv, timeSavedLine } from '@/lib/employer-volume/strip';
import { loadExportRows, loadRoleStrip } from '@/lib/server/employer-role-strip';
import { verifyInterview } from '@/lib/interview-token';
import { privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV with contact details for the owning employer, or a PDF summary with no contact details. Every export is logged. */
export async function GET(request: Request, context: { params: Promise<{ roleId: string }> }) {
  if (!employerVolumeEnabled()) return Response.json({ error: 'Not available.' }, { status: 404 });
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ configured: false }, { status: 503 });

  const { roleId } = await context.params;
  const format = new URL(request.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const { data: pack } = await client.from('screening_packs').select('id,workplace,signed_token,minutes_per_cv,employer_id').eq('id', roleId).maybeSingle();
  if (!pack || pack.employer_id !== user.id) return Response.json({ error: 'Role not found.' }, { status: 404 });
  const roleTitle = verifyInterview(pack.signed_token)?.title ?? 'Role';
  const fileStem = `muqabala-${roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role'}`;

  await admin.from('export_log').insert({ employer_id: user.id, role_id: pack.id, format });

  if (format === 'csv') {
    const reviewerEmails = new Map<string, string>([[user.id, user.email ?? user.id]]);
    const rows = await loadExportRows(client, pack.id, reviewerEmails);
    return new Response(exportCsv(rows), {
      headers: {
        ...privateNoStoreHeaders(),
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileStem}.csv"`,
      },
    });
  }

  const { strip, candidates } = await loadRoleStrip(client, pack.id);
  const minutes = typeof pack.minutes_per_cv === 'number' ? pack.minutes_per_cv : 4;
  const lines: PdfLine[] = [
    { text: 'Muqabala', size: 10 },
    { text: `${pack.workplace || 'Employer'}: ${roleTitle}`, size: 18, bold: true, gapBefore: 4 },
    { text: `Exported ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} Gulf time`, size: 9 },
    { text: `Invited ${strip.invited}   Answered ${strip.answered}   Full coverage ${strip.fullCoverage}   Shortlisted ${strip.shortlisted}   Decided ${strip.decided}`, size: 12, bold: true, gapBefore: 12 },
    { text: timeSavedLine(strip, minutes), size: 11 },
    { text: 'Decisions', size: 13, bold: true, gapBefore: 16 },
    { text: 'Ticks show rubric items with evidence. They are not a score. Every decision was made by a person.', size: 9 },
  ];
  for (const candidate of candidates) {
    const marks = candidate.coverage.items.map((item) => (item.covered ? 'Y' : 'N')).join(' ');
    const decision = candidate.decision ?? 'no decision yet';
    lines.push({ text: `${candidate.displayName}   rubric ${marks}   ${decision}`, size: 10, gapBefore: 2 });
  }
  return new Response(buildPdf(lines), {
    headers: {
      ...privateNoStoreHeaders(),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileStem}-summary.pdf"`,
    },
  });
}
