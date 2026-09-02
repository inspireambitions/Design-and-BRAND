import { after } from 'next/server';
import { z } from 'zod';
import { employerVolumeEnabled, whatsAppEnabled } from '@/lib/employer-volume';
import { MAX_CONTACTS, normaliseEmail, normalisePhone } from '@/lib/employer-volume/contacts';
import { processEmployerMessages } from '@/lib/server/employer-messages';
import { newCandidateRef, newInviteToken } from '@/lib/server/invite-token';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ContactSchema = z.object({
  email: z.string().trim().max(254).nullable(),
  phone: z.string().trim().max(20).nullable(),
  name: z.string().trim().max(100).nullable(),
});

const InvitesSchema = z.object({
  contacts: z.array(ContactSchema).min(1).max(MAX_CONTACTS),
  channel: z.enum(['email', 'whatsapp', 'both']).default('email'),
});

export async function POST(request: Request, context: { params: Promise<{ roleId: string }> }) {
  if (!employerVolumeEnabled()) return Response.json({ error: 'Not available.' }, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });

  const user = await currentUser();
  if (!user?.email_confirmed_at) return Response.json({ error: 'Sign in to add candidates.' }, { status: 401 });

  const { roleId } = await context.params;
  const supabase = await createClient();
  if (!supabase) return Response.json({ configured: false }, { status: 503 });
  // RLS: the employer can only read packs they own.
  const { data: pack } = await supabase
    .from('screening_packs')
    .select('id,public_code,expires_at,employer_id')
    .eq('id', roleId)
    .maybeSingle();
  if (!pack || pack.employer_id !== user.id) return Response.json({ error: 'Role not found.' }, { status: 404 });
  if (new Date(pack.expires_at).getTime() <= Date.now()) return Response.json({ error: 'This role has closed.' }, { status: 410 });

  const parsed = InvitesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid candidate list.' }, { status: 400 });

  const channel = whatsAppEnabled() ? parsed.data.channel : 'email';
  const rows: {
    role_id: string;
    candidate_ref: string;
    email: string | null;
    phone: string | null;
    name: string | null;
    channel: 'email' | 'whatsapp' | 'both';
    token_hash: string;
    token_cipher: string;
  }[] = [];
  let invalid = 0;
  const seen = new Set<string>();
  let duplicates = 0;

  for (const contact of parsed.data.contacts) {
    const email = contact.email ? normaliseEmail(contact.email) : null;
    const phone = contact.phone ? normalisePhone(contact.phone) : null;
    if (!email && !phone) { invalid += 1; continue; }
    const keys = [email ? `e:${email}` : null, phone ? `p:${phone}` : null].filter((key): key is string => Boolean(key));
    if (keys.some((key) => seen.has(key))) { duplicates += 1; continue; }
    for (const key of keys) seen.add(key);
    const token = newInviteToken();
    rows.push({
      role_id: pack.id,
      candidate_ref: newCandidateRef(),
      email,
      phone,
      name: contact.name || null,
      channel,
      token_hash: token.hash,
      token_cipher: token.cipher,
    });
  }
  if (rows.length === 0) return Response.json({ error: 'No valid contacts.' }, { status: 400 });

  // Existing invites for the same role are skipped rather than failing the batch.
  const { data: inserted, error } = await admin
    .from('role_invites')
    .upsert(rows, { onConflict: 'candidate_ref', ignoreDuplicates: true })
    .select('id,email,phone,channel');
  if (error) return Response.json({ error: 'Candidates could not be saved.' }, { status: 503 });

  const created = (inserted ?? []) as { id: string; email: string | null; phone: string | null; channel: string }[];
  const alreadyInvited = rows.length - created.length;

  const outbox: { role_id: string; invite_id: string; kind: 'invite'; channel: 'email' | 'whatsapp' }[] = [];
  let byEmail = 0;
  let byWhatsApp = 0;
  for (const invite of created) {
    if (invite.email && (channel === 'email' || channel === 'both')) {
      outbox.push({ role_id: pack.id, invite_id: invite.id, kind: 'invite', channel: 'email' });
      byEmail += 1;
    }
    if (invite.phone && whatsAppEnabled() && (channel === 'whatsapp' || channel === 'both')) {
      outbox.push({ role_id: pack.id, invite_id: invite.id, kind: 'invite', channel: 'whatsapp' });
      byWhatsApp += 1;
    }
  }
  if (outbox.length) {
    const { error: queueError } = await admin.from('employer_message_outbox').insert(outbox);
    if (queueError) return Response.json({ error: 'Invites were saved but could not be queued.' }, { status: 503 });
  }

  after(async () => { await processEmployerMessages({ roleId: pack.id, limit: 50 }); });

  return Response.json(
    {
      sent: created.length,
      byEmail,
      byWhatsApp,
      duplicates: duplicates + alreadyInvited,
      invalid,
    },
    { status: 201, headers: privateNoStoreHeaders() },
  );
}
