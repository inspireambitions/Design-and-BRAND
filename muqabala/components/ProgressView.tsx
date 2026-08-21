'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Attempt } from '@/lib/scoring';
import { clearAttempts, loadAttempts } from '@/lib/storage';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { ScoreRing } from './ScoreRing';

type RoleGroup = {
  roleId: string;
  roleTitle: string;
  attempts: Attempt[];
  /** Null when this role has no scored attempt yet. */
  best: number | null;
  first: number | null;
  latest: number | null;
};

export function ProgressView() {
  const { t } = useLang();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttempts(loadAttempts());
    setLoaded(true);
  }, []);

  const groups = useMemo<RoleGroup[]>(() => {
    const byRole = new Map<string, Attempt[]>();
    for (const attempt of attempts) {
      const list = byRole.get(attempt.roleId) ?? [];
      list.push(attempt);
      byRole.set(attempt.roleId, list);
    }
    return Array.from(byRole.entries()).map(([roleId, list]) => {
      // loadAttempts returns newest first; oldest is the first attempt.
      const chronological = [...list].reverse();
      const scored = list.map((a) => a.overallScore).filter((n): n is number => n !== null);
      const scoredChronological = chronological
        .map((a) => a.overallScore)
        .filter((n): n is number => n !== null);
      return {
        roleId,
        roleTitle: list[0].roleTitle,
        attempts: list,
        // Unscored interviews carry no number; they must not drag an average
        // down or masquerade as a zero in the candidate's own history.
        best: scored.length ? Math.max(...scored) : null,
        first: scoredChronological.length ? scoredChronological[0] : null,
        latest: scoredChronological.length ? scoredChronological[scoredChronological.length - 1] : null,
      };
    });
  }, [attempts]);

  const handleClear = () => {
    if (window.confirm(t('clearConfirm'))) {
      clearAttempts();
      setAttempts([]);
    }
  };

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} />

      <div className="stack-lg">
        <div>
          <p className="eyebrow">{t('progressTitle')}</p>
          <h1 style={{ fontSize: '1.9rem' }}>{t('progressTitle')}</h1>
        </div>

        {loaded && attempts.length === 0 && (
          <div className="card stack">
            <p className="muted">{t('progressEmpty')}</p>
            <div>
              <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                {t('startPractice')}
              </Link>
            </div>
          </div>
        )}

        {groups.map((group) => {
          // With no scored attempt there is no trend to report.
          const delta =
            group.latest !== null && group.first !== null ? group.latest - group.first : null;
          const deltaClass = delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
          return (
            <div key={group.roleId} className="card stack">
              <div className="score-head">
                <ScoreRing value={group.best ?? 0} />
                <div>
                  <h2 style={{ fontSize: '1.2rem' }}>{group.roleTitle}</h2>
                  <div className="row" style={{ marginTop: '0.4rem', gap: '0.4rem' }}>
                    <span className="chip chip-jade">
                      {t('best')} {group.best}
                    </span>
                    <span className="chip">
                      {group.attempts.length} {t('attempts')}
                    </span>
                    {group.attempts.length > 1 && delta !== null && (
                      <span className={`chip ${delta > 0 ? 'chip-good' : delta < 0 ? 'chip-crit' : ''}`}>
                        {t('improvement')} {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {group.attempts.map((attempt) => (
                  <div key={attempt.id} className="history-row">
                    <span className="muted">
                      {new Date(attempt.startedAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="comp-score">{attempt.overallScore === null ? '—' : `${attempt.overallScore}/100`}</span>
                    <span className={`delta ${deltaClass}`}>
                      {attempt.answers.length} {t('questions')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="row">
                <Link
                  href={`/practice/${group.roleId}`}
                  className="btn btn-quiet"
                  style={{ textDecoration: 'none' }}
                >
                  {t('practiceAgain')}
                </Link>
              </div>
            </div>
          );
        })}

        {attempts.length > 0 && (
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={handleClear}>
              {t('clearHistory')}
            </button>
          </div>
        )}
      </div>

      <footer className="foot">
        <span>{t('privacy')}</span>
        <span>Muqabala · Inspire Ambitions</span>
      </footer>
    </div>
  );
}
