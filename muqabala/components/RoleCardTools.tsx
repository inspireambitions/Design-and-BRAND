'use client';

import { useState } from 'react';
import styles from '@/app/employer/EmployerDashboard.module.css';
import { employerVolumeProps, track } from '@/lib/analytics';

/** Share summary (native share sheet where available, otherwise download) and the two export buttons. */
export function RoleCardTools({ roleId, roleTitle }: { roleId: string; roleTitle: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function shareSummary() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/employer/roles/${roleId}/summary`);
      if (!response.ok) { setMessage('The summary could not be generated.'); return; }
      const blob = await response.blob();
      track('summary_shared', employerVolumeProps(true, { role_id: roleId }));
      const file = new File([blob], 'muqabala-summary.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${roleTitle} shortlist summary` });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'muqabala-summary.png';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('The summary could not be shared.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.roleTools}>
      <button type="button" onClick={() => void shareSummary()} disabled={busy}>Share summary</button>
      <a href={`/api/employer/roles/${roleId}/export?format=csv`} onClick={() => track('export_downloaded', employerVolumeProps(true, { role_id: roleId, type: 'csv' }))}>Export CSV</a>
      <a href={`/api/employer/roles/${roleId}/export?format=pdf`} onClick={() => track('export_downloaded', employerVolumeProps(true, { role_id: roleId, type: 'pdf' }))}>Export PDF</a>
      {message && <small role="alert">{message}</small>}
    </div>
  );
}
