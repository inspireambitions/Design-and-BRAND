'use client';

import { useState } from 'react';
import styles from '@/app/c/[token]/share.module.css';

type Response = 'recommend' | 'not_this_one';

export function ShareResponse({ token, response }: { token: string; response: Response | null }) {
  const [saved, setSaved] = useState<Response | null>(response);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function respond(value: Response) {
    setBusy(true);
    setError('');
    try {
      const result = await fetch(`/api/c/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: value }),
      });
      if (!result.ok) { setError('Your response could not be saved. Try again.'); return; }
      setSaved(value);
    } catch {
      setError('Your response could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return <p className={styles.thanks}>Thank you. You said: <strong>{saved === 'recommend' ? 'Recommend' : 'Not this one'}</strong>. The hiring team can see this.</p>;
  }

  return (
    <div className={styles.respond}>
      <p>What do you think?</p>
      <div className={styles.respondButtons}>
        <button type="button" className={styles.recommend} disabled={busy} onClick={() => void respond('recommend')}>Recommend</button>
        <button type="button" className={styles.notThisOne} disabled={busy} onClick={() => void respond('not_this_one')}>Not this one</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
