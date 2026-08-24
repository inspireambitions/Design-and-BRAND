'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

type ExistingShare = { id: string; expires_at: string };

export function ReportActions({ interviewId, roleTitle, language, initialShares = [], initialSaved = false }: { interviewId: string; roleTitle: string; language: 'en' | 'ar'; initialShares?: ExistingShare[]; initialSaved?: boolean }) {
  const router = useRouter();
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const [message, setMessage] = useState('');
  const [shareId, setShareId] = useState<string | null>(null);
  const [existingShares, setExistingShares] = useState(initialShares);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialSaved);

  async function save() {
    if (busyAction) return;
    setBusyAction('save');
    try {
      const response = await fetch(`/api/interviews/${interviewId}/save`, { method: 'POST' });
      if (response.ok) setSaved(true);
      setMessage(response.ok ? tr('reportSavedPrivately') : tr('reportSaveFailed'));
    } catch {
      setMessage(tr('reportSaveFailed'));
    } finally {
      setBusyAction(null);
    }
  }

  async function share() {
    if (busyAction) return;
    setBusyAction('share');
    try {
      const response = await fetch(`/api/interviews/${interviewId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) return setMessage(tr('shareCreateFailed'));
      const text = `${roleTitle}\n${data.url}\n${tr('shareExpiryCopy')}`;
      setShareId(data.id);
      setExistingShares((items) => [{ id: data.id, expires_at: data.expiresAt }, ...items]);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      setMessage(tr('shareReady'));
    } catch {
      setMessage(tr('shareCreateFailed'));
    } finally {
      setBusyAction(null);
    }
  }

  async function revoke() {
    if (!shareId || busyAction) return;
    setBusyAction('revoke');
    if (await revokeById(shareId)) setShareId(null);
    setBusyAction(null);
  }

  async function revokeById(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/interviews/${interviewId}/share?shareId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        setMessage(tr('shareRevokeFailed'));
        return false;
      }
      setExistingShares((items) => items.filter((item) => item.id !== id));
      setMessage(tr('shareRevoked'));
      return true;
    } catch {
      setMessage(tr('shareRevokeFailed'));
      return false;
    }
  }

  async function deleteReport() {
    if (busyAction || !window.confirm(tr('deleteReportConfirm'))) return;
    setBusyAction('delete');
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, { method: 'DELETE' });
      if (!response.ok) return setMessage(tr('reportDeleteFailed'));
      router.push('/account');
      router.refresh();
    } catch {
      setMessage(tr('reportDeleteFailed'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="stack-sm no-print">
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={Boolean(busyAction) || saved} onClick={save}>
          {saved ? tr('savedToAccount') : tr('saveToAccount')}
        </button>
        {saved && <a className="btn btn-quiet" href="/account">{tr('viewMyAccount')}</a>}
        <button type="button" className="btn btn-quiet" disabled={Boolean(busyAction)} onClick={share}>{tr('shareWhatsApp')}</button>
        {shareId && <button type="button" className="btn btn-ghost" disabled={Boolean(busyAction)} onClick={revoke}>{tr('revokeShare')}</button>}
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{tr('saveAsPdf')}</button>
        <button type="button" className="btn btn-ghost" disabled={Boolean(busyAction)} onClick={deleteReport}>{tr('deleteReport')}</button>
      </div>
      {message && <p className="notice tiny" role="status">{message}</p>}
      {existingShares.length > 0 && <div className="card-flat stack-sm">
        <span className="rate-label">{tr('activePrivateLinks')}</span>
        {existingShares.map((share) => <div className="row" key={share.id} style={{ justifyContent: 'space-between' }}>
          <span className="tiny">{tr('expires')} {new Date(share.expires_at).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-GB')}</span>
          <button type="button" className="btn btn-ghost" disabled={Boolean(busyAction)} onClick={async () => {
            if (busyAction) return;
            setBusyAction(`revoke:${share.id}`);
            await revokeById(share.id);
            setBusyAction(null);
          }}>{tr('revoke')}</button>
        </div>)}
      </div>}
    </div>
  );
}
