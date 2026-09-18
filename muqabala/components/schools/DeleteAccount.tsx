'use client';
import { useState } from 'react';
import Link from 'next/link';

export function SchoolsDeleteAccount() {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  return (
    <div style={{ maxWidth: '640px', margin: '24px auto', padding: '0 16px' }}>
      <p style={{ marginBottom: '16px' }}>
        <Link href="/schools/me/settings" style={{ fontSize: '14px', color: '#4a5568' }}>
          &larr; Back to account settings
        </Link>
      </p>

      <section className="schools-card" style={{ borderColor: '#fca5a5' }}>
        <h1 style={{ color: '#991b1b', fontSize: '20px', margin: '0 0 12px' }}>Delete your schools data</h1>
        <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: 1.5, margin: '0 0 12px' }}>
          This permanently removes your institutional interview answers, feedback reports, adviser reviews, and cohort membership. You cannot undo this action.
        </p>
        <p style={{ color: '#166534', fontSize: '13px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px', margin: '0 0 16px' }}>
          <strong>Your personal data is preserved:</strong> Any public or personal practice sessions, employer applications, and account authentication details remain completely unaffected.
        </p>

        {!done && (
          <form
            method="post"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                const response = await fetch('/api/schools/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirm: confirmed }),
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error);
                setDone(true);
                setMessage(
                  (body.localDeleted
                    ? 'Your schools records have been removed. External checks remain pending.'
                    : 'Your deletion request is saved and your schools access has ended. Deletion will be retried.') +
                    ' Reference: ' +
                    body.reference
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Could not request deletion.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div style={{ margin: '16px 0', padding: '12px', background: '#fff1f2', borderRadius: '6px', border: '1px solid #fecdd3' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#9f1239', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>I understand this permanently deletes my institutional submissions and evaluations from my university records.</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={busy || !confirmed}
                style={{
                  background: confirmed ? '#dc2626' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: confirmed ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? 'Processing deletion...' : 'Confirm permanent deletion'}
              </button>
              <Link href="/schools/me/settings" style={{ fontSize: '14px', color: '#4a5568' }}>
                Cancel
              </Link>
            </div>
          </form>
        )}

        {message && (
          <div
            role="status"
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '6px',
              background: done ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${done ? '#86efac' : '#fca5a5'}`,
              color: done ? '#166534' : '#991b1b',
              fontSize: '14px',
            }}
          >
            {message}
          </div>
        )}
      </section>
    </div>
  );
}
