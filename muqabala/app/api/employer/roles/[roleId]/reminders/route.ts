import { after } from 'next/server';
import { z } from 'zod';
import { verifyStoredInterview } from '@/lib/interview-token';
import { pageCount, pageRange, positivePage } from '@/lib/pagination';
import { reminderEligibility } from '@/lib/recruiter-suite';
import { employerEmailConfigured, processEmployerMessages } from '@/lib/server/employer-messages';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SendSchema = z.object({
  inviteIds: z.array(z.string().uuid()).min(1).max(500),
  message: z.string().trim().min(1).max(2000),
  batchKey: z.string().uuid(),
}).strict().refine((value) => value.message.includes('{{invitation_link}}'), { message: 'The invitation link is required.' });

const RECIPIENT_PAGE_SIZE = 100;

async function ownedRole(roleId: string) {
  const employer = await currentUser();
  if (!employer?.email_confirmed_at) return null;
  const client = await createClient();
  if (!client) return null;
  const { data } = await client.from('screening_packs')
    .select('id,public_code,workplace,signed_token,expires_at,reminders_enabled,timezone')
    .eq('id', roleId)
    .eq('employer_id', employer.id)
    .maybeSingle();
  return data ? { employer, client, role: data } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await context.params;
  const owned = await ownedRole(roleId);
  if (!owned) return Response.json({ error: 'Role not found.' }, { status: 404 });
  const page = positivePage(new URL(_request.url).searchParams.get('page'));
  const range = pageRange(page, RECIPIENT_PAGE_SIZE);
  const { data: rows, error, count } = await owned.client.from('role_invites')
    .select('id,name,email,status,contact_allowed,opted_out_at,withdrawn_at,deleted_at,last_manual_reminder_at,first_reminder_at,second_reminder_at,completion_reminder_at', { count: 'exact' })
    .eq('role_id', roleId)
    .order('created_at')
    .range(range.from, range.to);
  if (error) return Response.json({ error: 'Reminder eligibility could not be loaded.' }, { status: 503 });
  const inviteIds = (rows ?? []).map((row) => row.id);
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Reminder delivery status could not be loaded.' }, { status: 503 });
  const statusResult = inviteIds.length ? await admin.from('employer_message_outbox')
    .select('invite_id,status,last_error_code,updated_at,created_at')
    .eq('role_id', roleId)
    .eq('kind', 'manual_reminder')
    .in('invite_id', inviteIds)
    .order('created_at', { ascending: false })
    .limit(2000) : { data: [], error: null };
  if (statusResult.error) return Response.json({ error: 'Reminder delivery status could not be loaded.' }, { status: 503 });
  const statusRows = statusResult.data;
  const delivery = { queued: 0, accepted: 0, delivered: 0, failed: 0, cancelled: 0 };
  const latestByInvite = new Map<string, { status: string; errorCode: string | null; updatedAt: string }>();
  for (const row of statusRows ?? []) {
    if (row.invite_id && !latestByInvite.has(row.invite_id)) {
      latestByInvite.set(row.invite_id, { status: row.status, errorCode: row.last_error_code, updatedAt: row.updated_at || row.created_at });
    }
  }
  for (const row of latestByInvite.values()) {
    const key = row.status === 'pending' || row.status === 'processing' ? 'queued' : row.status;
    if (key in delivery) delivery[key as keyof typeof delivery] += 1;
  }
  const recipients = (rows ?? []).map((row) => {
    const latest = latestByInvite.get(row.id);
    return reminderEligibility({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      contactAllowed: row.contact_allowed,
      optedOutAt: row.opted_out_at,
      withdrawnAt: row.withdrawn_at,
      deletedAt: row.deleted_at,
      lastManualReminderAt: row.last_manual_reminder_at,
      firstReminderAt: row.first_reminder_at,
      secondReminderAt: row.second_reminder_at,
      completionReminderAt: row.completion_reminder_at,
      deliveryStatus: latest?.status,
      deliveryUpdatedAt: latest?.updatedAt,
      deliveryErrorCode: latest?.errorCode,
    }, { expiresAt: owned.role.expires_at, remindersEnabled: owned.role.reminders_enabled !== false });
  });
  const title = verifyStoredInterview(owned.role.signed_token)?.title ?? 'this role';
  const closes = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: owned.role.timezone || 'Asia/Dubai' }).format(new Date(owned.role.expires_at));
  const defaultMessage = `Hello,\n\nThis is a reminder to complete the ${title} work sample before ${closes} (${owned.role.timezone || 'Asia/Dubai'}).\n\n{{invitation_link}}\n\nA person from the hiring team will review your answers.`;
  return Response.json({
    recipients: recipients.map((recipient) => ({ ...recipient, deliveryStatus: latestByInvite.get(recipient.id)?.status ?? null })),
    eligibleCount: recipients.filter((recipient) => recipient.eligible).length,
    configured: employerEmailConfigured(),
    publicLinkFallback: (count ?? 0) === 0,
    publicUrl: `${new URL(_request.url).origin}/s/${owned.role.public_code}`,
    defaultMessage,
    delivery,
    pagination: { page, pageSize: RECIPIENT_PAGE_SIZE, total: count ?? 0, totalPages: pageCount(count ?? 0, RECIPIENT_PAGE_SIZE) },
  }, { headers: privateNoStoreHeaders() });
}

export async function POST(request: Request, context: { params: Promise<{ roleId: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { roleId } = await context.params;
  const owned = await ownedRole(roleId);
  if (!owned) return Response.json({ error: 'Role not found.' }, { status: 404 });
  if (!employerEmailConfigured()) return Response.json({ error: 'Automated email delivery is not configured. Copy the reminder instead.' }, { status: 503 });
  const parsed = SendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Check the recipients and reminder text.' }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Reminder delivery is unavailable.' }, { status: 503 });
  const { data, error } = await admin.rpc('queue_manual_employer_reminders', {
    p_role_id: roleId,
    p_employer_id: owned.employer.id,
    p_invite_ids: parsed.data.inviteIds,
    p_message: parsed.data.message,
    p_batch_key: parsed.data.batchKey,
  });
  if (error || !data) return Response.json({ error: error?.code === '22023' ? 'No selected recipients are currently eligible.' : 'The reminders could not be queued. Safe to retry.' }, { status: error?.code === '22023' ? 409 : 503 });
  after(async () => { await processEmployerMessages({ roleId, limit: 5 }); });
  return Response.json(data, { status: 201, headers: privateNoStoreHeaders() });
}
