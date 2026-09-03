import { cookies } from 'next/headers';
import { z } from 'zod';
import { emailHash, hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { sealPrivateText } from '@/lib/server/private-data';
import { recordEvaluationAccess } from '@/lib/server/evaluation-report';
import {
  createEvaluationShareSession,
  currentEvaluationShareViewer,
  evaluationShareCookieName,
  logEvaluationShareOpen,
  loadEvaluationShare,
} from '@/lib/server/evaluation-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EmailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) }).strict();

function unavailable(state: Awaited<ReturnType<typeof loadEvaluationShare>>) {
  if (state.status === 'closed') return Response.json({ error: 'This private link has expired or was closed.' }, { status: 410, headers: privateNoStoreHeaders() });
  if (state.status === 'decision_required') return Response.json({ error: 'This report is not open for sharing.' }, { status: 403, headers: privateNoStoreHeaders() });
  return Response.json({ error: 'Private report not found.' }, { status: 404, headers: privateNoStoreHeaders() });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = EmailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: privateNoStoreHeaders() });
  const { token } = await params;
  const state = await loadEvaluationShare(token);
  if (state.status !== 'ok') return unavailable(state);
  const normalisedEmail = parsed.data.email;
  const viewerHash = emailHash(normalisedEmail);
  const store = await cookies();
  store.set(evaluationShareCookieName(state.shareId), createEvaluationShareSession(state.shareId, viewerHash, state.expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(state.expiresAt),
  });
  await recordEvaluationAccess({
    reportDatabaseId: state.reportDatabaseId,
    reportVersion: state.report.report_version,
    action: 'VIEW',
    viewerEmailHash: viewerHash,
    viewerEmailCiphertext: sealPrivateText(normalisedEmail),
  });
  return Response.json({ opened: true }, { headers: privateNoStoreHeaders() });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadEvaluationShare(token);
  if (state.status !== 'ok') return unavailable(state);
  const viewer = await currentEvaluationShareViewer(state);
  if (!viewer) return Response.json({ error: 'Email confirmation is required.' }, { status: 401, headers: privateNoStoreHeaders() });
  await logEvaluationShareOpen(state, viewer.viewerEmailHash);
  return Response.json({ reportId: state.report.report_id, version: state.report.report_version }, { headers: privateNoStoreHeaders() });
}
