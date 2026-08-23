import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hashClaimEmail, hashClaimToken, newClaimToken } from '@/lib/report-crypto';
import { limitReportCreation } from '@/lib/report-rate-limit';
import { SaveReportRequestSchema, type StoredReport } from '@/lib/saved-report';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MAX_BODY_BYTES = 48_000;

function unavailable() {
  return NextResponse.json(
    { error: 'Cross-device saving is not available yet.' },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Report is too large.' }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Report is too large.' }, { status: 413 });
  }

  let parsed: ReturnType<typeof SaveReportRequestSchema.safeParse>;
  try {
    parsed = SaveReportRequestSchema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the email address and try again.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable();

  let emailHash: string;
  try {
    emailHash = hashClaimEmail(parsed.data.email);
  } catch {
    return unavailable();
  }

  const rate = await limitReportCreation(request, emailHash);
  if (!rate.configured) return unavailable();
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many save requests. Try again shortly.', retryAfter: rate.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const claimToken = newClaimToken();
  const claimExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const { error } = await admin.from('saved_reports').insert({
    owner_id: null,
    role_id: parsed.data.report.roleId,
    role_title: parsed.data.report.roleTitle,
    overall_score: parsed.data.report.overallScore,
    answers: parsed.data.report.answers,
    expires_at: claimExpiresAt.toISOString(),
    claim_token_hash: hashClaimToken(claimToken),
    claim_email_hash: emailHash,
    claim_expires_at: claimExpiresAt.toISOString(),
  });

  if (error) return NextResponse.json({ error: 'We could not prepare this report.' }, { status: 500 });
  return NextResponse.json({ claimToken, claimExpiresAt: claimExpiresAt.toISOString() });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return unavailable();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_reports')
    .select('id, role_id, role_title, overall_score, answers, created_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: 'Reports could not be loaded.' }, { status: 500 });

  const reports: StoredReport[] = (data ?? []).map((report) => ({
    id: report.id,
    roleId: report.role_id,
    roleTitle: report.role_title,
    overallScore: report.overall_score,
    answers: report.answers,
    createdAt: report.created_at,
    expiresAt: report.expires_at,
  }));
  return NextResponse.json({ reports });
}
