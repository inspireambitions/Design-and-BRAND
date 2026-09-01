import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { roleFromToken, verifyInterview } from '@/lib/interview-token';
import { limitShare } from '@/lib/rate-limit';
import { buildScreeningInvitationEmail } from '@/lib/screening-invitation-email';
import {
  normaliseInvitationEmail,
  screeningInvitationEmailHash,
  screeningInvitationToken,
  screeningInvitationTokenHash,
} from '@/lib/server/screening-invitations';
import { configuredOrigin, hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const ParamsSchema = z.string().uuid();
const InvitationSchema = z.object({ email: z.string().trim().email().max(254) }).strict();
const EMAIL_FROM = 'Muqabala <hello@auth.trymuqabala.com>';

type InvitationRow = {
  id: string;
  recipient_email_hash: string;
  status: 'pending' | 'accepted' | 'failed';
  expires_at: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const employer = await currentUser();
  if (!employer?.email || !employer.email_confirmed_at) {
    return Response.json({ error: 'Sign in with your verified employer email.' }, { status: 401 });
  }
  const { id: rawId } = await params;
  const id = ParamsSchema.safeParse(rawId);
  const parsed = InvitationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return Response.json({ error: 'Enter a valid candidate email.' }, { status: 400 });

  const admin = createAdminClient();
  const apiKey = process.env.RESEND_TRANSACTIONAL_API_KEY || process.env.RESEND_FEEDBACK_API_KEY;
  if (!admin || !apiKey) return Response.json({ error: 'Candidate invitations are not configured.' }, { status: 503 });
  const { data: pack, error: packError } = await admin.from('screening_packs')
    .select('id,employer_id,public_code,signed_token,workplace,expires_at,closed_at,max_candidates,starts_used')
    .eq('id', id.data)
    .eq('employer_id', employer.id)
    .maybeSingle();
  if (packError) return Response.json({ error: 'The work sample could not be checked.' }, { status: 503 });
  if (!pack) return Response.json({ error: 'Work sample not found.' }, { status: 404 });
  if (pack.closed_at) return Response.json({ error: 'This work sample is closed.' }, { status: 409 });
  if (Date.parse(pack.expires_at) <= Date.now()) return Response.json({ error: 'This work sample has expired.' }, { status: 410 });
  if (pack.starts_used >= pack.max_candidates) return Response.json({ error: 'This work sample has reached its candidate limit.' }, { status: 409 });

  const payload = verifyInterview(pack.signed_token);
  if (!payload || payload.kind !== 'proof') return Response.json({ error: 'The work sample could not be verified.' }, { status: 503 });
  const email = normaliseInvitationEmail(parsed.data.email);
  const recipientEmailHash = screeningInvitationEmailHash(email);
  if (!recipientEmailHash) return Response.json({ error: 'Candidate invitations are not configured.' }, { status: 503 });

  let { data: invitation, error: readError } = await admin.from('screening_email_invitations')
    .select('id,recipient_email_hash,status,expires_at')
    .eq('screening_pack_id', pack.id)
    .eq('recipient_email_hash', recipientEmailHash)
    .maybeSingle<InvitationRow>();
  if (readError) return Response.json({ error: 'The invitation could not be prepared.' }, { status: 503 });

  if (!invitation) {
    const invitationId = randomUUID();
    const rawToken = screeningInvitationToken({ invitationId, packId: pack.id, recipientEmailHash });
    if (!rawToken) return Response.json({ error: 'Candidate invitations are not configured.' }, { status: 503 });
    const inserted = await admin.from('screening_email_invitations').insert({
      id: invitationId,
      screening_pack_id: pack.id,
      employer_id: employer.id,
      recipient_email_hash: recipientEmailHash,
      token_hash: screeningInvitationTokenHash(rawToken),
      expires_at: pack.expires_at,
    }).select('id,recipient_email_hash,status,expires_at').maybeSingle<InvitationRow>();
    if (inserted.error) {
      const raced = await admin.from('screening_email_invitations')
        .select('id,recipient_email_hash,status,expires_at')
        .eq('screening_pack_id', pack.id)
        .eq('recipient_email_hash', recipientEmailHash)
        .maybeSingle<InvitationRow>();
      if (raced.error || !raced.data) return Response.json({ error: 'The invitation could not be prepared.' }, { status: 503 });
      invitation = raced.data;
    } else {
      invitation = inserted.data;
    }
  }
  if (!invitation) return Response.json({ error: 'The invitation could not be prepared.' }, { status: 503 });
  if (invitation.status === 'accepted') {
    return Response.json({ sent: true, alreadySent: true, deliveryStatus: 'accepted', expiresAt: invitation.expires_at }, { headers: privateNoStoreHeaders() });
  }

  const limited = await limitShare(request, employer.id);
  if (limited.limited) {
    return Response.json({ error: 'Too many invitations requested. Please wait and try again.' }, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfterSeconds), ...privateNoStoreHeaders() },
    });
  }
  const rawToken = screeningInvitationToken({
    invitationId: invitation.id,
    packId: pack.id,
    recipientEmailHash: invitation.recipient_email_hash,
  });
  if (!rawToken) return Response.json({ error: 'Candidate invitations are not configured.' }, { status: 503 });
  const invitationUrl = `${configuredOrigin()}/s/${pack.public_code}?invite=${encodeURIComponent(rawToken)}`;
  const role = roleFromToken(payload);
  const message = buildScreeningInvitationEmail({
    companyName: pack.workplace || payload.workplace || 'An employer',
    roleTitle: role.title,
    invitationUrl,
    expiresAt: invitation.expires_at,
  });

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `screening_invitation_${invitation.id}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(7_000),
    });
  } catch {
    await admin.from('screening_email_invitations')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', invitation.id).eq('employer_id', employer.id);
    return Response.json({ error: 'The invitation could not be sent. Please try again.' }, { status: 502 });
  }
  if (!response.ok) {
    await admin.from('screening_email_invitations')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', invitation.id).eq('employer_id', employer.id);
    return Response.json({ error: 'The invitation could not be sent. Please try again.' }, { status: 502 });
  }
  const provider = await response.json().catch(() => ({})) as { id?: string };
  const acceptedAt = new Date().toISOString();
  const { error: updateError } = await admin.from('screening_email_invitations').update({
    status: 'accepted',
    provider_message_id: typeof provider.id === 'string' ? provider.id.slice(0, 200) : null,
    accepted_at: acceptedAt,
    updated_at: acceptedAt,
  }).eq('id', invitation.id).eq('employer_id', employer.id);
  if (updateError) return Response.json({ error: 'The invitation was accepted for sending, but its status could not be saved.' }, { status: 503 });
  return Response.json({ sent: true, alreadySent: false, deliveryStatus: 'accepted', expiresAt: invitation.expires_at }, { status: 201, headers: privateNoStoreHeaders() });
}

