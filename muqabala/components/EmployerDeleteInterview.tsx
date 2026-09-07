'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from '@phosphor-icons/react';
import styles from '@/app/employer/EmployerDashboard.module.css';

export function EmployerDeleteInterview({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function deleteInterview() {
    const confirmed = window.confirm('Delete this interview and all its recordings? This cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/employer/interviews/${interviewId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'The interview could not be deleted.');
      }
      router.replace('/employer');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The interview could not be deleted.');
      setDeleting(false);
    }
  }

  return (
    <div className={styles.deleteControl}>
      <button type="button" className={styles.deleteInterview} disabled={deleting} onClick={() => void deleteInterview()}>
        <Trash aria-hidden="true" />
        {deleting ? 'Deleting…' : 'Delete interview'}
      </button>
      {error && <p className={styles.deleteError} role="alert">{error}</p>}
    </div>
  );
}
