import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptJson, tokenHash, verifyPlanViewToken } from '@/lib/practice-plan/crypto';
import { SevenDayPlanSchema, type SevenDayPlan } from '@/lib/practice-plan/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

type Snapshot = { plan: SevenDayPlan; viewToken: string };

export default async function PracticePlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyPlanViewToken(token);
  if (!verified) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();
  const { data: grant } = await admin.from('scoped_magic_link_grants')
    .select('plan_request_id,scope,expires_at,revoked_at,token_hash')
    .eq('id', verified.grantId)
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (!grant || grant.scope !== 'practice_plan:view' || grant.revoked_at || Date.parse(grant.expires_at) <= Date.now()) notFound();
  const { data: request } = await admin.from('practice_plan_requests')
    .select('locale,expires_at')
    .eq('id', grant.plan_request_id)
    .maybeSingle();
  if (!request || Date.parse(request.expires_at) <= Date.now()) notFound();
  const { data: storedSnapshot } = await admin.from('practice_plan_snapshots')
    .select('plan_ciphertext')
    .eq('plan_request_id', grant.plan_request_id)
    .maybeSingle();
  if (!storedSnapshot) notFound();
  let plan: SevenDayPlan;
  try {
    const snapshot = decryptJson<Snapshot>(storedSnapshot.plan_ciphertext);
    plan = SevenDayPlanSchema.parse(snapshot.plan);
  } catch {
    notFound();
  }
  const ar = request.locale === 'ar';
  return (
    <main className="shell shell-narrow" lang={ar ? 'ar' : 'en'} dir={ar ? 'rtl' : 'ltr'}>
      <TopBar showProgressLink={false} />
      <article className="stack-lg practice-plan-view">
        <header className="card stack-sm">
          <p className="eyebrow">Muqabala</p>
          <h1>{ar ? 'خطة التدريب لمدة 7 أيام' : 'Your 7-day practice plan'}</h1>
          <p>{plan.summary}</p>
        </header>
        {plan.days.map((day) => (
          <section className="card stack-sm" key={day.day}>
            <p className="eyebrow">{ar ? 'اليوم' : 'Day'} {day.day}</p>
            <h2>{day.focus}</h2>
            <p><strong>{ar ? 'لماذا يهم هذا' : 'Why this matters'}:</strong> {day.whyThisMatters}</p>
            <p>{day.exercise}</p>
            <p className="tiny">{day.estimatedMinutes} {ar ? 'دقيقة' : 'minutes'}</p>
            <p><strong>{ar ? 'علامة النجاح' : 'Success check'}:</strong> {day.successCheck}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
