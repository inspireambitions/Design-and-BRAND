'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CUSTOM_ROLE_ID, getRole } from '@/lib/roles';
import type { Attempt } from '@/lib/scoring';
import { computeReadiness, type Readiness } from '@/lib/readiness';
import { loadAttemptsForRole } from '@/lib/storage';
import { useLang } from './LanguageProvider';

export type ReadinessSnapshot = Readiness & {
  /** Role title in the current language; the candidate's own title for the custom role. */
  roleTitle: string;
};

/** Rough duration of the count-up. Long enough to read as movement, short enough not to delay the page. */
const ANIMATION_MS = 600;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

function useAttemptsForRole(roleId: string): Attempt[] | null {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  useEffect(() => {
    const read = () => setAttempts(loadAttemptsForRole(roleId));
    read();
    // Another tab finishing an interview updates this one too.
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [roleId]);
  return attempts;
}

/**
 * Current readiness for a role from the local attempt history. Null until the
 * history has been read on the client, or when the role id is unknown. A
 * parent that wants the count-up should capture `score` before it saves a new
 * attempt and pass it back as `previous`.
 */
export function useReadiness(roleId: string, extraAttempts: Attempt[] = []): ReadinessSnapshot | null {
  const { lang } = useLang();
  const stored = useAttemptsForRole(roleId);
  return useMemo(() => {
    if (stored === null) return null;
    const role = getRole(roleId);
    if (!role) return null;
    // Signed-in candidates keep their durable copy on the server rather than in
    // this browser, so the sitting just finished is passed in by the parent.
    const seen = new Set(stored.map((attempt) => attempt.id));
    const attempts = [...stored, ...extraAttempts.filter((attempt) => !seen.has(attempt.id))];
    const readiness = computeReadiness(attempts, role);
    const typedTitle = roleId === CUSTOM_ROLE_ID ? attempts[0]?.roleTitle?.trim() : '';
    const roleTitle = typedTitle || (lang === 'ar' ? role.titleAr : role.title);
    return { ...readiness, roleTitle };
  }, [stored, extraAttempts, roleId, lang]);
}

/** The score a role had from local history alone, before the sitting that has just finished. */
export function readinessBeforeSitting(roleId: string): number | undefined {
  const role = getRole(roleId);
  if (!role) return undefined;
  return computeReadiness(loadAttemptsForRole(roleId), role).score;
}

/** Counts from the value first shown to the target, or jumps when motion is reduced. */
function useAnimatedNumber(target: number, initial: number): number {
  const [shown, setShown] = useState(initial);
  const shownRef = useRef(initial);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof window.requestAnimationFrame !== 'function') {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / ANIMATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (target - from) * eased);
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

function ReadinessDial({
  snapshot,
  size,
  previous,
}: {
  snapshot: ReadinessSnapshot;
  size: 'compact' | 'full';
  previous?: number;
}) {
  const { t, lang } = useLang();
  const shown = useAnimatedNumber(snapshot.score, previous ?? snapshot.score);
  const label = fill(t('readinessFor'), { role: snapshot.roleTitle });
  const aria = fill(t('readinessAria'), { role: snapshot.roleTitle, score: snapshot.score });
  const covered = snapshot.coverage.filter((item) => item.covered);
  const notYet = snapshot.coverage.filter((item) => !item.covered);
  const competencyLabel = (item: { label: string; labelAr: string }) => (lang === 'ar' ? item.labelAr : item.label);

  return (
    <section className={`readiness readiness-${size}`} aria-label={aria}>
      <div className="readiness-head">
        <div
          className={`score-ring readiness-ring${size === 'full' ? ' readiness-ring-lg' : ''}`}
          style={{ ['--pct' as string]: shown, ['--ring-color' as string]: 'var(--jade)' }}
          role="img"
          aria-label={aria}
        >
          <div className="score-ring-inner">{shown}</div>
        </div>
        <div className="readiness-text">
          <p className="readiness-label">{label}</p>
          <p className="readiness-meta">
            <span className="readiness-out-of">{t('readinessOutOf')}</span>
            <span aria-hidden="true"> · </span>
            {fill(t('readinessQuestions'), {
              practised: snapshot.questionsPractised,
              total: snapshot.questionsTotal,
            })}
          </p>
        </div>
      </div>

      {size === 'full' && (
        <div className="readiness-coverage">
          <div className="readiness-coverage-group">
            <p className="readiness-coverage-title">{t('readinessCovered')}</p>
            {covered.length === 0 ? (
              <p className="muted tiny">{t('readinessNotYet')}</p>
            ) : (
              <ul className="readiness-chips" aria-label={t('readinessCovered')}>
                {covered.map((item) => (
                  <li key={item.competencyId} className="chip chip-good">
                    {competencyLabel(item)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notYet.length > 0 && (
            <div className="readiness-coverage-group">
              <p className="readiness-coverage-title">{t('readinessNotYet')}</p>
              <ul className="readiness-chips" aria-label={t('readinessNotYet')}>
                {notYet.map((item) => (
                  <li key={item.competencyId} className="chip">
                    {competencyLabel(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted tiny readiness-how">{t('readinessHow')}</p>
        </div>
      )}
    </section>
  );
}

/**
 * One readiness number for a role. `compact` is the feedback-screen header:
 * ring, label and the questions line. `full` adds the covered and not-yet
 * competency lists for the dashboard. Renders nothing until local history has
 * been read, so the server and first client paint match.
 */
export function ReadinessScore({
  roleId,
  size,
  previous,
  extraAttempts,
}: {
  roleId: string;
  size: 'compact' | 'full';
  /** Value shown before the count-up begins. Omit to show the current value without animation. */
  previous?: number;
  /** Attempts not yet in local history, such as the sitting that has just finished. */
  extraAttempts?: Attempt[];
}) {
  const snapshot = useReadiness(roleId, extraAttempts);
  if (!snapshot) return null;
  return <ReadinessDial snapshot={snapshot} size={size} previous={previous} />;
}
