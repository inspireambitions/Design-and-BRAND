'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from '@phosphor-icons/react';
import { recordDecision } from '@/app/employer/actions';
import { normaliseEmployerDecision, type DashboardDecision } from '@/lib/employer-dashboard';
import styles from '@/app/employer/EmployerDashboard.module.css';

type Props = {
  interviewId: string;
  candidateLabel: string;
  currentDecision: string | null;
};

function statusCopy(decision: DashboardDecision) {
  if (decision === 'shortlisted') return 'Shortlisted';
  if (decision === 'not_proceeding') return 'Not proceeding';
  return '';
}

export function DashboardDecisionActions({ interviewId, candidateLabel, currentDecision }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<DashboardDecision>(() => normaliseEmployerDecision(currentDecision));
  const [busy, setBusy] = useState<DashboardDecision>(null);
  const [message, setMessage] = useState(() => statusCopy(normaliseEmployerDecision(currentDecision)));
  const [error, setError] = useState('');

  async function decide(decision: 'shortlist' | 'pass') {
    const normalised = decision === 'shortlist' ? 'shortlisted' : 'not_proceeding';
    if (busy || selected === normalised) return;

    setBusy(normalised);
    setError('');
    setMessage('Saving...');
    const result = await recordDecision({ interviewId, decision });
    setBusy(null);

    if ('error' in result) {
      setMessage(statusCopy(selected));
      setError(result.error);
      return;
    }

    setSelected(normalised);
    setMessage(`${statusCopy(normalised)} saved`);
    router.refresh();
  }

  return (
    <div className={styles.decisionActions}>
      <button
        type="button"
        aria-label={`Shortlist ${candidateLabel}`}
        aria-pressed={selected === 'shortlisted'}
        disabled={Boolean(busy) || selected === 'shortlisted'}
        onClick={() => void decide('shortlist')}
      >
        <Check aria-hidden="true" weight={selected === 'shortlisted' ? 'bold' : 'regular'} />
      </button>
      <button
        type="button"
        aria-label={`Mark ${candidateLabel} as not proceeding`}
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
