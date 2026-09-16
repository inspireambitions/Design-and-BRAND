'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RosterParseResult } from '@/lib/schools/types';

export function RosterUpload({ cohortId }: { cohortId: string }) {
  const router = useRouter();
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<RosterParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [committedCount, setCommittedCount] = useState<number | null>(null);
  const [enrolmentLinks, setEnrolmentLinks] = useState<Array<{ name: string; url: string }> | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setPreview(null);
    setCommittedCount(null);
    setEnrolmentLinks(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      await parsePreview(content);
    };
    reader.readAsText(file);
  }

  async function parsePreview(csvData: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/schools/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortId,
          csvData,
          operation: 'preview',
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not parse roster CSV.');
      setPreview(body.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!fileContent) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/schools/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortId,
          csvData: fileContent,
          operation: 'commit',
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not enrol students.');

      setCommittedCount(body.enrolledCount);
      setEnrolmentLinks(body.enrolmentLinks || []);
      setPreview(null);
      setFileContent('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enrol students.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="schools-card" aria-label="Student roster import">
      <h2>Bulk Student Roster Import</h2>
      <p>
        Upload a CSV file of students to provision access. Supports Arabic names and student identifiers.
        Headers accepted: <code>Student ID / الرقم الجامعي</code>, <code>Name / الاسم</code>, <code>Email / البريد الإلكتروني</code>.
      </p>

      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      {committedCount !== null && (
        <div role="status" style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '4px', marginBottom: '1rem' }}>
          <p style={{ color: '#065f46', fontWeight: 600 }}>
            Successfully enrolled {committedCount} student{committedCount === 1 ? '' : 's'}.
          </p>
          {enrolmentLinks && enrolmentLinks.length > 0 && (
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', color: '#047857' }}>
                View generated student access links ({enrolmentLinks.length})
              </summary>
              <ul style={{ fontSize: '0.85em', marginTop: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                {enrolmentLinks.map((link, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>
                    <strong>{link.name}:</strong> <code style={{ fontSize: '0.8em' }}>{link.url}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div>
        <label htmlFor="roster-csv-file" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Select CSV File
        </label>
        <input
          id="roster-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          disabled={busy}
        />
        {fileName && <p style={{ fontSize: '0.85em', color: '#666', marginTop: '0.25rem' }}>Loaded: {fileName}</p>}
      </div>

      {preview && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <h3>Roster Preview</h3>
          <p>
            Total rows detected: <strong>{preview.total}</strong> | Ready to enrol: <strong>{preview.valid.length}</strong>
            {preview.duplicates.length > 0 && <span> | Duplicates: <strong>{preview.duplicates.length}</strong></span>}
            {preview.invalid.length > 0 && <span style={{ color: '#b91c1c' }}> | Invalid: <strong>{preview.invalid.length}</strong></span>}
          </p>

          {preview.valid.length > 0 && (
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                    <th style={{ padding: '0.35rem' }}>ID</th>
                    <th style={{ padding: '0.35rem' }}>Name</th>
                    <th style={{ padding: '0.35rem' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.35rem' }}>{row.studentIdentifier || '-'}</td>
                      <td style={{ padding: '0.35rem' }}>{row.name}</td>
                      <td style={{ padding: '0.35rem' }}>{row.email || '-'}</td>
                    </tr>
                  ))}
                  {preview.valid.length > 10 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '0.35rem', textAlign: 'center', color: '#666' }}>
                        ... and {preview.valid.length - 10} more students
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="schools-actions">
            <button
              type="button"
              disabled={busy || preview.valid.length === 0}
              onClick={handleCommit}
              className="schools-button"
            >
              {busy ? 'Enrolling...' : `Confirm & Enrol ${preview.valid.length} Student${preview.valid.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" disabled={busy} onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
