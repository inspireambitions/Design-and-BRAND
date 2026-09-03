import { buildEvaluationPdf, evaluationPdfFilename } from '@/lib/evaluation-report-pdf';
import { loadOwnedEvaluationReport, recordEvaluationAccess } from '@/lib/server/evaluation-report';
import { privateNoStoreHeaders } from '@/lib/server/security';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: privateNoStoreHeaders() });
  const { id } = await params;
  const current = await loadOwnedEvaluationReport(id, user.id);
  if (!current) return Response.json({ error: 'Evaluation not found.' }, { status: 404, headers: privateNoStoreHeaders() });
  if (!current.report.decision) {
    return Response.json({ error: 'Record a decision before downloading the PDF.' }, { status: 403, headers: privateNoStoreHeaders() });
  }
  await recordEvaluationAccess({
    reportDatabaseId: current.databaseId,
    reportVersion: current.report.report_version,
    action: 'DOWNLOAD',
    actorUserId: user.id,
  });
  return new Response(buildEvaluationPdf(current.report), {
    headers: {
      ...privateNoStoreHeaders(),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${evaluationPdfFilename(current.report)}"`,
    },
  });
}
