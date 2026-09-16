'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ProgrammeOption = {
  id: string;
  name: string;
  code?: string | null;
  faculty?: string | null;
  campus?: string | null;
};

export function CohortModal({
  institutionId,
  programmes = [],
  onClose,
}: {
  institutionId?: string;
  programmes?: ProgrammeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [campus, setCampus] = useState('');
  const [faculty, setFaculty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Auto-populate faculty/campus if programme is selected and has defaults
  function handleProgrammeChange(id: string) {
    setProgrammeId(id);
    if (id) {
      const selected = programmes.find((p) => p.id === id);
      if (selected) {
        if (selected.faculty && !faculty) setFaculty(selected.faculty);
        if (selected.campus && !campus) setCampus(selected.campus);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Cohort name is required.');
      return;
    }
    if (!institutionId) {
      setError('Institution ID is missing.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/schools/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'cohort',
          payload: {
            institutionId,
            name: name.trim(),
            programmeId: programmeId || undefined,
            faculty: faculty.trim() || undefined,
            campus: campus.trim() || undefined,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not create cohort.');
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create cohort.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="schools-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cohort-modal-title">
      <div className="schools-card schools-modal-content">
        <h2 id="cohort-modal-title">Create New Cohort</h2>
        <p>Set up a cohort of learners to assign interview practice, track progress, and provide feedback.</p>

        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="cohort-name">
              Cohort Name * <span style={{ fontSize: '0.85em', color: '#666' }}>(e.g. Class of 2026, Section B, Fall 2026 Intake)</span>
            </label>
            <input
              id="cohort-name"
              type="text"
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Spring 2026 Intake"
            />
          </div>

          <div>
            <label htmlFor="cohort-programme">
              Academic / Vocational Programme <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional)</span>
            </label>
            <select
              id="cohort-programme"
              value={programmeId}
              onChange={(e) => handleProgrammeChange(e.target.value)}
              disabled={busy}
            >
              <option value="">None (Independent Cohort)</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''} {p.faculty ? `— ${p.faculty}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cohort-faculty">
              Faculty / Department <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional dimension)</span>
            </label>
            <input
              id="cohort-faculty"
              type="text"
              maxLength={160}
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              disabled={busy}
              placeholder="e.g. School of Computing"
            />
          </div>

          <div>
            <label htmlFor="cohort-campus">
              Campus <span style={{ fontSize: '0.85em', color: '#666' }}>(Optional dimension)</span>
            </label>
            <input
              id="cohort-campus"
              type="text"
              maxLength={160}
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              disabled={busy}
              placeholder="e.g. City Campus"
            />
          </div>

          <div className="schools-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Creating...' : 'Create Cohort'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
