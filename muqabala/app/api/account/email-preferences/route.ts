import { z } from 'zod';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { CAREER_EMAIL_CONSENT } from '@/lib/email/consent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PreferenceSchema = z.object({
  marketingOptIn: z.boolean(),
  lang: z.enum(['en', 'ar']),
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = PreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid email preference.' }, { status: 400 });
  const user = await currentUser();
  const admin = createAdminClient();
  if (!user || !admin) return Response.json({ error: 'Sign in to change this preference.' }, { status: 401 });

  const now = new Date().toISOString();
  const consent = CAREER_EMAIL_CONSENT[parsed.data.lang];
  const { data: currentPreference, error: currentPreferenceError } = await admin.from('lifecycle_email_preferences')
    .select('suppressed_at,suppression_reason').eq('user_id', user.id).maybeSingle();
  if (currentPreferenceError) return Response.json({ error: 'We could not check your email preference.' }, { status: 503 });
  if (parsed.data.marketingOptIn && currentPreference?.suppressed_at) {
    return Response.json({ marketingOptIn: false, scheduled: false, suppressed: true }, { headers: privateNoStoreHeaders() });
  }
  const { error } = parsed.data.marketingOptIn
    ? await admin.from('lifecycle_email_preferences').upsert({
      user_id: user.id,
      locale: parsed.data.lang,
      marketing_opt_in: true,
      consent_version: consent.version,
      consent_copy: consent.copy,
      consent_source: 'account_dashboard',
      consented_at: now,
      unsubscribed_at: null,
    }, { onConflict: 'user_id' })
    : await admin.from('lifecycle_email_preferences').upsert({
      user_id: user.id,
      locale: parsed.data.lang,
      marketing_opt_in: false,
      unsubscribed_at: now,
    }, { onConflict: 'user_id' });
  if (error) return Response.json({ error: 'We could not save your preference.' }, { status: 503 });

  if (parsed.data.marketingOptIn) {
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const { data: existingJob, error: lookupError } = await admin.from('lifecycle_email_jobs')
      .select('id,status,resend_email_id').eq('user_id', user.id).eq('email_type', 'career_tools_24h').maybeSingle();
    if (lookupError) return Response.json({ error: 'Your choice was saved, but the email schedule could not be checked.' }, { status: 503 });
    const { error: jobError } = existingJob
      ? ['pending','processing','sent','delivered','bounced','complained','suppressed'].includes(existingJob.status) || existingJob.resend_email_id
        ? { error: null }
        : await admin.from('lifecycle_email_jobs').update({
          locale: parsed.data.lang, due_at: dueAt, next_attempt_at: dueAt, status: 'pending',
          attempt_count: 0, lease_until: null, cancelled_at: null, last_error_code: null,
        }).eq('id', existingJob.id)
      : await admin.from('lifecycle_email_jobs').insert({
        user_id: user.id, email_type: 'career_tools_24h', locale: parsed.data.lang,
        due_at: dueAt, next_attempt_at: dueAt,
      });
    if (jobError) return Response.json({ error: 'Your choice was saved, but the email could not be scheduled.' }, { status: 503 });
    return Response.json({ marketingOptIn: true, scheduled: !existingJob || !['sent','delivered'].includes(existingJob.status) }, { headers: privateNoStoreHeaders() });
  } else {
    const { error: cancelError } = await admin.from('lifecycle_email_jobs').update({
      status: 'cancelled', cancelled_at: now, lease_until: null, last_error_code: 'unsubscribed',
    }).eq('user_id', user.id).eq('email_type', 'career_tools_24h').eq('status', 'pending');
    if (cancelError) return Response.json({ error: 'Your preference was saved, but the pending email could not be cancelled.' }, { status: 503 });
  }

  return Response.json({ marketingOptIn: false }, { headers: privateNoStoreHeaders() });
}
