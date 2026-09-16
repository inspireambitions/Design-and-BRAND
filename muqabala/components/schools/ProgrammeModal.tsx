'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProgrammeModal({
  institutionId,
  initialProgramme,
  onClose,
}: {
  institutionId?: string;
  initialProgramme?: {
    id: string;
    name: string;
    code?: string | null;
    campus?: string | null;
    faculty?: string | null;
    description?: string | null;
    status?: string;
  } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialProgramme?.name || '');
  const [code, setCode] = useState(initialProgramme?.code || '');
  const [campus, setCampus] = useState(initialProgramme?.campus || '');
  const [faculty, setFaculty] = useState(initialProgramme?.faculty || '');
  const [description, setDescription] = useState(initialProgramme?.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Programme name is required.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/schools/programmes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId,
          programmeId: initialProgramme?.id,
          name: name.trim(),
          code: code.trim() || undefined,
          campus: campus.trim() || undefined,
          faculty: faculty.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save programme.');
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save programme.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="schools-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="programme-modal-title">
      <div className="schools-card schools-modal-content">
        <h2 id="programme-modal-title">
          {initialProgramme ? 'Edit Programme' : 'Add Academic / Vocational Programme'}
        </h2>
        <p>Define an institutional programme to organise cohorts and curricula.</p>

        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="prog-name">
              Programme Name * <span style={{ fontSize: '0.85em', color: '#666' }}>(e.g. BSc Computer Science, Diploma in Hospitality)</span>
            </label>
            <input
              id="prog-name"
              type="text"
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="Programme title"
            />
          </div>

          <div>
            <label htmlFor="prog-code">
              Programme Code <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional, e.g. CS-2026, HOSP-101)</span>
            </label>
            <input
              id="prog-code"
              type="text"
              maxLength={32}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
              placeholder="Optional reference code"
            />
          </div>

          <div>
            <label htmlFor="prog-faculty">
              Faculty / School <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional dimension)</span>
            </label>
            <input
              id="prog-faculty"
              type="text"
              maxLength={160}
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              disabled={busy}
              placeholder="e.g. Faculty of Engineering, School of Business"
            />
          </div>

          <div>
            <label htmlFor="prog-campus">
              Campus <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional dimension)</span>
            </label>
            <input
              id="prog-campus"
              type="text"
              maxLength={160}
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              disabled={busy}
              placeholder="e.g. Dubai Main Campus, Abu Dhabi"
            />
          </div>

          <div>
            <label htmlFor="prog-desc">
              Programme Description <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional)</span>
            </label>
            <textarea
              id="prog-desc"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              placeholder="Overview of this academic track"
            />
          </div>

          <div className="schools-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Saving...' : initialProgramme ? 'Save Changes' : 'Create Programme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
