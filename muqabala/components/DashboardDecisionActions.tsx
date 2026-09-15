'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from '@phosphor-icons/react';
import { recordDecision } from '@/app/employer/actions';
import { normaliseEmployerDecision, type DashboardDecision } from '@/lib/employer-dashboard';
import styles from '@/app/employer/EmployerDashboard.module.css';
import { useLang } from './LanguageProvider';

type Props = {
  interviewId: string;
  candidateLabel: string;
  currentDecision: string | null;
};

function statusCopy(decision: DashboardDecision, copy: { shortlist: string; pass: string; hold: string }) {
  if (decision === 'shortlisted') return copy.shortlist;
  if (decision === 'not_proceeding') return copy.pass;
  if (decision === 'hold') return copy.hold;
  return '';
}

export function DashboardDecisionActions({ interviewId, candidateLabel, currentDecision }: Props) {
  const router = useRouter();
  const { t } = useLang();
  const [selected, setSelected] = useState<DashboardDecision>(() => normaliseEmployerDecision(currentDecision));
  const [busy, setBusy] = useState<DashboardDecision>(null);
  const decisionCopy = { shortlist: t('employerShortlist'), pass: t('employerNotProceeding'), hold: t('employerHoldStatus') };
  const [message, setMessage] = useState(() => statusCopy(normaliseEmployerDecision(currentDecision), decisionCopy));
  const [error, setError] = useState('');
  useEffect(() => {
    const decision = normaliseEmployerDecision(currentDecision);
    setSelected(decision);
    setMessage(statusCopy(decision, decisionCopy));
  // Translation values are stable for a selected site language.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDecision, t]);

  async function decide(decision: 'shortlist' | 'pass') {
    const normalised = decision === 'shortlist' ? 'shortlisted' : 'not_proceeding';
    if (busy || selected === normalised) return;

    setBusy(normalised);
    setError('');
    setMessage(t('employerSaving'));
    try {
      const result = await recordDecision({ interviewId, decision });
      if ('error' in result) {
        setMessage(statusCopy(selected, decisionCopy));
        setError(result.error);
        return;
      }
      setSelected(normalised);
      setMessage(decision === 'shortlist' ? t('employerAddedShortlist') : t('employerDecisionSaved'));
      router.refresh();
    } catch {
      setMessage(statusCopy(selected, decisionCopy));
      setError(t('employerActionInterrupted'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.decisionActions}>
      <button
        type="button"
        aria-label={`${t('employerShortlist')}: ${candidateLabel}`}
        aria-pressed={selected === 'shortlisted'}
        disabled={Boolean(busy) || selected === 'shortlisted'}
        onClick={() => void decide('shortlist')}
      >
        <Check aria-hidden="true" weight={selected === 'shortlisted' ? 'bold' : 'regular'} />
      </button>
      <button
        type="button"
        aria-label={`${t('employerNotProceeding')}: ${candidateLabel}`}
        aria-pressed={selected === 'not_proceeding'}
        disabled={Boolean(busy) || selected === 'not_proceeding'}
        onClick={() => void decide('pass')}
      >
        <X aria-hidden="true" weight={selected === 'not_proceeding' ? 'bold' : 'regular'} />
      </button>
      {(message || error) && (
        <span className={error ? styles.decisionError : styles.decisionStatus} role={error ? 'alert' : 'status'}>
          {error || message}
        </span>
      )}
    </div>
  );
}
