'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateRoleClosingDate } from '@/app/employer/actions';
import { formatZonedLocalDateTime } from '@/lib/timezone';
import styles from './RoleDeadlineEditor.module.css';

export function RoleDeadlineEditor({ roleId, expiresAt, timezone }: { roleId: string; expiresAt: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => formatZonedLocalDateTime(expiresAt, timezone));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await updateRoleClosingDate({ roleId, localClosing: value, timezone });
      setMessage('error' in result ? result.error : 'Closing date updated.');
      if ('ok' in result) { setOpen(false); router.refresh(); }
    } catch {
      setMessage('The closing date could not be updated. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <div className={styles.row}><button type="button" onClick={() => setOpen(true)}>Edit closing date</button>{message && <span role="status">{message}</span>}</div>;
  return <div className={styles.editor}>
    <label><span>Closing date and time · {timezone}</span><input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} /></label>
    <div><button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save closing date'}</button><button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
    {message && <p role="status">{message}</p>}
  </div>;
}
