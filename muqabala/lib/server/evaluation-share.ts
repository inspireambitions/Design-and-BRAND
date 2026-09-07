import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { isOpaqueToken, tokenHash } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { hydrateEvaluationReport, recordEvaluationAccess } from './evaluation-report';

export type EvaluationShareState =
  | { status: 'not_found' | 'closed' | 'decision_required' }
  | {
      status: 'ok';
      shareId: string;
      expiresAt: string;
      reportDatabaseId: string;
      report: NonNullable<Awaited<ReturnType<typeof hydrateEvaluationReport>>>;
    };

function signingKey(): string {
  const key = process.env.INTERVIEW_SECRET;
  if (!key) throw new Error('share_session_not_configured');
  return key;
}

export function evaluationShareCookieName(shareId: string): string {
  return `muqabala_eval_${shareId.replaceAll('-', '')}`;
}

export function createEvaluationShareSession(shareId: string, viewerEmailHash: string, expiresAt: string): string {
  const payload = Buffer.from(JSON.stringify({ shareId, viewerEmailHash, expiresAt }), 'utf8').toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyEvaluationShareSession(value: string | undefined, shareId: string): { viewerEmailHash: string } | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { shareId?: string; viewerEmailHash?: string; expiresAt?: string };
    if (parsed.shareId !== shareId || !parsed.viewerEmailHash || !/^[0-9a-f]{64}$/.test(parsed.viewerEmailHash)) return null;
    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return { viewerEmailHash: parsed.viewerEmailHash };
  } catch { return null; }
}

export async function loadEvaluationShare(rawToken: string): Promise<EvaluationShareState> {
  if (!isOpaqueToken(rawToken)) return { status: 'not_found' };
  const admin = createAdminClient();
  if (!admin) return { status: 'not_found' };
  const { data: share } = await admin.from('evaluation_report_shares')
    .select('id,report_id,expires_at,revoked_at')
    .eq('token_hash', tokenHash(rawToken))
    .maybeSingle();
  if (!share) return { status: 'not_found' };
  if (share.revoked_at || new Date(share.expires_at).getTime() <= Date.now()) return { status: 'closed' };
  const { data: row } = await admin.from('candidate_evaluation_reports')
    .select('id,report_id,version,payload,interviewer_name,employer_id,created_at')
    .eq('id', share.report_id)
    .maybeSingle();
  if (!row) return { status: 'not_found' };
  const report = await hydrateEvaluationReport(row);
  if (!report) return { status: 'not_found' };
  if (!report.decision) return { status: 'decision_required' };
  return { status: 'ok', shareId: share.id, expiresAt: share.expires_at, reportDatabaseId: row.id, report };
}

export async function currentEvaluationShareViewer(state: Extract<EvaluationShareState, { status: 'ok' }>) {
  const store = await cookies();
  return verifyEvaluationShareSession(store.get(evaluationShareCookieName(state.shareId))?.value, state.shareId);
}

export async function logEvaluationShareOpen(
  state: Extract<EvaluationShareState, { status: 'ok' }>,
  viewerEmailHash: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: previous } = await admin.from('evaluation_report_access_log')
    .select('viewer_email_ciphertext')
    .eq('report_id', state.reportDatabaseId)
    .eq('viewer_email_hash', viewerEmailHash)
    .not('viewer_email_ciphertext', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  await recordEvaluationAccess({
    reportDatabaseId: state.reportDatabaseId,
    reportVersion: state.report.report_version,
    action: 'VIEW',
    viewerEmailHash,
    viewerEmailCiphertext: previous?.viewer_email_ciphertext ?? null,
  });
}
