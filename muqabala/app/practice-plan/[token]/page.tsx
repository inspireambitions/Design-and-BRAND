import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { QuestionTags } from '@/components/QuestionTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptJson, tokenHash, verifyPlanViewToken } from '@/lib/practice-plan/crypto';
import { practiceDeepLink } from '@/lib/practice-plan/plan';
import { SevenDayPlanSchema, type SevenDayPlan } from '@/lib/practice-plan/schema';
import type { PlanSnapshot } from '@/lib/practice-plan/worker';
import { configuredOrigin } from '@/lib/server/security';
import { PlanLanding } from '../PlanLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

const copy = {
  en: {
    eyebrow: 'Your seven-day plan',
    title: (role: string) => `One ${role} question a day`,
    intro: 'Each link opens the question in the mode you chose. Answer, read the feedback, and come back tomorrow.',
    day: 'Day',
    answered: 'The question you answered',
    sample: 'A strong sample answer',
    open: 'Answer this question',
    hint: 'Hint',
  },
  ar: {
    eyebrow: 'خطتك لسبعة أيام',
    title: (role: string) => `سؤال واحد كل يوم لوظيفة ${role}`,
    intro: 'يفتح كل رابط السؤال بالطريقة التي اخترتها. أجب، واقرأ الملاحظات، وعُد غداً.',
    day: 'اليوم',
    answered: 'السؤال الذي أجبت عنه',
    sample: 'نموذج إجابة قوية',
    open: 'أجب عن هذا السؤال',
    hint: 'تلميح',
  },
} as const;

export default async function PracticePlanPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
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
    plan = SevenDayPlanSchema.parse(decryptJson<PlanSnapshot>(storedSnapshot.plan_ciphertext).plan);
  } catch {
    notFound();
  }

  const lang = plan.locale;
  const ar = lang === 'ar';
  const c = copy[lang];
  const origin = configuredOrigin();
  const rawDay = typeof query.day === 'string' ? Number(query.day) : NaN;
  const day = Number.isInteger(rawDay) && rawDay >= 1 && rawDay <= 7 ? rawDay : null;
  const landing = day ? plan.days[day - 1] : null;

  return (
    <main className="shell shell-narrow" lang={lang} dir={ar ? 'rtl' : 'ltr'}>
      <TopBar showProgressLink={false} />
      <article className="stack-lg practice-plan-view">
        <header className="card stack-sm">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{c.title(plan.roleTitle)}</h1>
          <p className="muted">{c.intro}</p>
          {landing && day && (
            <PlanLanding
              day={day}
              roleId={plan.roleId}
              lang={lang}
              planRef={tokenHash(token)}
              target={practiceDeepLink(origin, plan, landing.questionId)}
            />
          )}
        </header>
        {plan.days.map((item) => (
          <section className="card stack-sm" key={item.day} aria-current={item.day === day ? 'step' : undefined}>
            <p className="eyebrow">{c.day} {item.day}</p>
            <h2>{item.questionText}</h2>
            {item.hint && <p className="muted">{c.hint}: {item.hint}</p>}
            <QuestionTags tags={item.tags} lang={lang} />
            <p>
              <a className="btn btn-primary" href={practiceDeepLink(origin, plan, item.questionId)}>{c.open}</a>
            </p>
          </section>
        ))}
        <section className="card stack-sm">
          <p className="eyebrow">{c.answered}</p>
          <h2>{plan.focusQuestionText}</h2>
          <h3>{c.sample}</h3>
          {plan.sampleAnswer.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
      </article>
    </main>
  );
}
