'use client';

import Link from 'next/link';
import type { InterventionSignal } from '@/lib/schools/types';

export function InterventionQueue({
  cohortId,
  signals,
}: {
  cohortId: string;
  signals: InterventionSignal[];
}) {
  if (signals.length === 0) {
    return (
      <section className="schools-card" aria-label="Intervention Queue">
        <h2>Support & Intervention Queue</h2>
        <p style={{ color: '#059669', fontWeight: 500 }}>
          All learners in this cohort are on track. No immediate interventions flagged.
        </p>
      </section>
    );
  }

  const categoryLabels: Record<string, string> = {
    deadline_unstarted: 'Deadline Approaching — Not Started',
    stalled_draft: 'Stalled Draft',
    low_evidence: 'Low Rubric Evidence',
    stagnant_attempts: 'No Evidence Progression',
    support_requested: 'Adviser Support Requested',
  };

  return (
    <section className="schools-card" aria-label="Intervention Queue">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h2>Support & Intervention Queue</h2>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            Evidence-based flags to identify learners who may benefit from adviser outreach.
          </p>
        </div>
        <span style={{
          fontSize: '0.85rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '9999px',
          background: '#fee2e2',
          color: '#991b1b',
          fontWeight: 600,
        }}>
          {signals.length} Flag{signals.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th scope="col" style={{ padding: '0.5rem' }}>Learner</th>
              <th scope="col" style={{ padding: '0.5rem' }}>Signal</th>
              <th scope="col" style={{ padding: '0.5rem' }}>Observable Evidence</th>
              <th scope="col" style={{ padding: '0.5rem' }}>Suggested Action</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((sig) => {
              const isUrgent = sig.severity === 'urgent';
              return (
                <tr key={sig.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                    <strong>
                      <Link href={`/schools/cohorts/${cohortId}/students/${sig.studentId}`}>
                        {sig.studentName}
                      </Link>
                    </strong>
                    {sig.studentIdentifier && (
                      <span style={{ display: 'block', fontSize: '0.8em', color: '#6b7280' }}>
                        ID: {sig.studentIdentifier}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: isUrgent ? '#fee2e2' : '#fef3c7',
                      color: isUrgent ? '#991b1b' : '#92400e',
                      fontWeight: 600,
                      marginBottom: '0.25rem',
                    }}>
                      {categoryLabels[sig.category] || sig.category}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{sig.humanReason}</p>
                  </td>
                  <td style={{ padding: '0.5rem', verticalAlign: 'top', fontSize: '0.85rem', color: '#4b5563' }}>
                    <code>{sig.evidenceBasis}</code>
                  </td>
                  <td style={{ padding: '0.5rem', verticalAlign: 'top', fontSize: '0.85rem' }}>
                    <span style={{ display: 'block', marginBottom: '0.25rem', color: '#374151' }}>
                      {sig.suggestedAction}
                    </span>
                    <Link
                      href={`/schools/cohorts/${cohortId}/students/${sig.studentId}`}
                      className="schools-button"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      View Student
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
