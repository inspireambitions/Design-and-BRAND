'use client';
import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';

export function SchoolsSupport({
  cohortId,
  studentId,
  initial,
  owned,
  unclaimed = false,
}: {
  cohortId: string;
  studentId: string;
  initial: { status: string; note: string } | null;
  owned: boolean;
  unclaimed?: boolean;
}) {
  const controlId = useId();
  const router = useRouter();
  const [status, setStatus] = useState(initial?.status ?? 'open');
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!unclaimed) return;
    let active = true;
    fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'claim_support', payload: { cohortId, studentId } }),
    })
      .then((response) => {
        if (response.ok && active) router.refresh();
      })
      .catch(() => {
        if (active) setMessage('Could not claim this request. Save to try again.');
      });
    return () => {
      active = false;
    };
  }, [cohortId, studentId, unclaimed, router]);

  const statusBadges: Record<string, { label: string; bg: string; text: string }> = {
    open: { label: 'Open — Action Needed', bg: '#fee2e2', text: '#991b1b' },
    scheduled: { label: 'Scheduled — 1:1 Consultation Planned', bg: '#fef3c7', text: '#92400e' },
    closed: { label: 'Resolved & Closed', bg: '#dcfce7', text: '#166534' },
  };

  const currentBadge = statusBadges[initial?.status ?? 'open'] ?? { label: initial?.status ?? 'None', bg: '#f3f4f6', text: '#374151' };

  return (
    <section className="schools-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#075c50', textTransform: 'uppercase' }}>
            Adviser Intervention
          </span>
          <h2 style={{ margin: '4px 0 0' }}>1:1 Student Support Request</h2>
        </div>
        {initial && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: currentBadge.bg,
              color: currentBadge.text,
            }}
          >
            {currentBadge.label}
          </span>
        )}
      </div>

      {!initial && (
        <p style={{ color: '#64748b' }}>No active support request currently logged for this student.</p>
      )}

      {!owned ? (
        <p style={{ color: '#4b5563', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px' }}>
          Another adviser is currently the primary owner of this support thread.
        </p>
      ) : (
        <>
          {initial && (
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor={controlId + '-status'} style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                Resolution Lifecycle Status
              </label>
              <select
                id={controlId + '-status'}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="open">Open — Awaiting adviser outreach or review</option>
                <option value="scheduled">Scheduled — 1:1 advisory consultation booked</option>
                <option value="closed">Closed — Support completed and resolved</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor={controlId + '-note'} style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
              Adviser Guidance Note <span style={{ fontWeight: 'normal', color: '#64748b' }}>(Visible directly to the student)</span>
            </label>
            <textarea
              id={controlId + '-note'}
              value={note}
              maxLength={1000}
              placeholder="e.g. Let's discuss your CAR/STAR structure for Question 2 during office hours Thursday at 2 PM. Book via your student portal."
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  const response = await fetch('/api/schools', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      operation: 'adviser_support',
                      payload: { cohortId, studentId, status, note },
                    }),
                  });
                  const body = await response.json();
                  if (!response.ok) throw new Error(body.error);
                  setMessage('Support request updated. You are assigned as its owner.');
                  router.refresh();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Could not save.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving...' : initial ? 'Update Support Request' : 'Log Adviser Support'}
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" style={{ marginTop: '12px', color: message.includes('updated') ? '#075c50' : '#c53030' }}>
          {message}
        </p>
      )}
    </section>
  );
}
