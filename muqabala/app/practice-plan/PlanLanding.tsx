'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initAnalytics, track } from '@/lib/analytics';
import { attachPlanLocally, beginVisit } from '@/lib/practice-plan/second-session';

/**
 * The landing step behind every daily link. It counts the click, attaches the
 * plan to this device, then forwards to the question in the candidate's chosen
 * mode. The target link is rendered too, so a slow or blocked script never
 * strands anyone on this page.
 */
export function PlanLanding({ day, roleId, target, planRef, lang }: {
  day: number;
  roleId: string;
  /** The practice deep link: /practice/[roleId]?focus=...&mode=...&lang=... */
  target: string;
  /** SHA-256 of the plan token; never the token itself. */
  planRef: string;
  lang: 'en' | 'ar';
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAnalytics();
    track('plan_link_clicked', { day, role_id: roleId, lang });
    const visit = beginVisit();
    if (visit.isSecondSession) track('second_session', { role_id: roleId, lang });
    attachPlanLocally({ planRef, roleId, day });
    setReady(true);
    const timer = window.setTimeout(() => router.replace(target), 250);
    return () => window.clearTimeout(timer);
  }, [day, roleId, target, planRef, lang, router]);

  const ar = lang === 'ar';
  return (
    <p className="notice" role="status" aria-live="polite">
      {ready
        ? (ar ? `جارٍ فتح سؤال اليوم ${day}…` : `Opening your day ${day} question…`)
        : (ar ? 'لحظة من فضلك…' : 'One moment…')}{' '}
      <a href={target} className="link">{ar ? 'افتحه الآن' : 'Open it now'}</a>
    </p>
  );
}
