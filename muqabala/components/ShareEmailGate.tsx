'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ShareEmailGate.module.css';

export function ShareEmailGate({ token, employer }: { token: string; employer: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const response = await fetch(`/api/evaluation-share/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error || 'This private report could not be opened.');
      return;
    }
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void open(event)}>
        <p>Private Muqabala report</p>
        <h1>Confirm your email to view</h1>
        <span>{employer} shared one stored candidate report with you. Your email and each open are recorded for the audit trail.</span>
        <label>Email address<input type="email" required autoComplete="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Opening…' : 'Open private report'}</button>
        {error && <small role="alert">{error}</small>}
      </form>
    </main>
  );
}
