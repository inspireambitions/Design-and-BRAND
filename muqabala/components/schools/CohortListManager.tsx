'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProgrammeModal } from './ProgrammeModal';
import { CohortModal, type ProgrammeOption } from './CohortModal';

export type CohortCardSummary = {
  id: string;
  name: string;
  campus?: string | null;
  faculty?: string | null;
  programme?: string | null;
  programme_id?: string | null;
  activeStudents: number;
  submitted: number;
  notReviewed: number;
  focusAssignment: {
    id: string;
    roleId: string;
    dueAt: string;
  } | null;
  nextAction: string;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function CohortListManager({
  institutionId,
  cohorts,
  programmes = [],
}: {
  institutionId?: string;
  cohorts: CohortCardSummary[];
  programmes?: ProgrammeOption[];
}) {
  const [showProgrammeModal, setShowProgrammeModal] = useState(false);
  const [showCohortModal, setShowCohortModal] = useState(false);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string>('all');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');

  // Derive unique faculties from cohorts and programmes
  const availableFaculties = useMemo(() => {
    const set = new Set<string>();
    cohorts.forEach((c) => {
      if (c.faculty) set.add(c.faculty);
    });
    programmes.forEach((p) => {
      if (p.faculty) set.add(p.faculty);
    });
    return Array.from(set).sort();
  }, [cohorts, programmes]);

  // Filter cohorts
  const filteredCohorts = useMemo(() => {
    return cohorts.filter((c) => {
      if (selectedProgrammeId !== 'all') {
        if (selectedProgrammeId === 'none') {
          if (c.programme_id) return false;
        } else if (c.programme_id !== selectedProgrammeId) {
          return false;
        }
      }
      if (selectedFaculty !== 'all' && c.faculty !== selectedFaculty) {
        return false;
      }
      return true;
    });
  }, [cohorts, selectedProgrammeId, selectedFaculty]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {programmes.length > 0 && (
            <div>
              <label htmlFor="filter-prog" style={{ fontSize: '0.8rem', color: '#42665b' }}>
                Filter by Programme:
              </label>
              <select
                id="filter-prog"
                value={selectedProgrammeId}
                onChange={(e) => setSelectedProgrammeId(e.target.value)}
                style={{ padding: '6px 10px', margin: '4px 0 0', width: 'auto', display: 'inline-block' }}
              >
                <option value="all">All Programmes ({cohorts.length})</option>
                {programmes.map((p) => {
                  const count = cohorts.filter((c) => c.programme_id === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({count})
                    </option>
                  );
                })}
                <option value="none">
                  Unassigned / Independent ({cohorts.filter((c) => !c.programme_id).length})
                </option>
              </select>
            </div>
          )}

          {availableFaculties.length > 0 && (
            <div>
              <label htmlFor="filter-fac" style={{ fontSize: '0.8rem', color: '#42665b' }}>
                Filter by Faculty:
              </label>
              <select
                id="filter-fac"
                value={selectedFaculty}
                onChange={(e) => setSelectedFaculty(e.target.value)}
                style={{ padding: '6px 10px', margin: '4px 0 0', width: 'auto', display: 'inline-block' }}
              >
                <option value="all">All Faculties</option>
                {availableFaculties.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="schools-button"
            style={{ background: '#f8f6ef', color: '#075c50', border: '1px solid #075c50' }}
            onClick={() => setShowProgrammeModal(true)}
          >
            + Add Programme
          </button>
          <button
            type="button"
            className="schools-button"
            onClick={() => setShowCohortModal(true)}
          >
            + New Cohort
          </button>
        </div>
      </div>

      {filteredCohorts.length === 0 ? (
        <section className="schools-card">
          <p>No cohorts match the selected filters.</p>
        </section>
      ) : (
        <section className="schools-dashboard-list" aria-label="Assigned cohorts">
          {filteredCohorts.map((row) => {
            const actionHref =
              row.nextAction === 'assign'
                ? `/schools/cohorts/${row.id}/assign`
                : row.nextAction === 'review'
                ? `/schools/cohorts/${row.id}/review?assignment=${row.focusAssignment!.id}`
                : `/schools/cohorts/${row.id}`;

            const actionLabel =
              row.nextAction === 'assign'
                ? 'Create assignment'
                : row.nextAction === 'review'
                ? `Review ${row.notReviewed} awaiting review`
                : row.nextAction === 'progress'
                ? 'View progress'
                : 'Open cohort';

            const prog = programmes.find((p) => p.id === row.programme_id);
            const programmeName = prog ? prog.name : row.programme;

            return (
              <article className="schools-card schools-dashboard-card" key={row.id}>
                <div className="schools-dashboard-card-heading">
                  <div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="schools-eyebrow" style={{ margin: 0 }}>
                        Cohort
                      </span>
                      {programmeName && (
                        <span
                          className="schools-state"
                          style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 6px' }}
                        >
                          {programmeName}
                        </span>
                      )}
                      {row.faculty && (
                        <span
                          className="schools-state"
                          style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 6px' }}
                        >
                          {row.faculty}
                        </span>
                      )}
                      {row.campus && (
                        <span
                          className="schools-state"
                          style={{ background: '#f3f4f6', color: '#374151', fontSize: '11px', padding: '2px 6px' }}
                        >
                          {row.campus}
                        </span>
                      )}
                    </div>
                    <h2>
                      <Link href={`/schools/cohorts/${row.id}`}>{row.name}</Link>
                    </h2>
                  </div>
                  <Link className="schools-button" href={actionHref}>
                    {actionLabel}
                  </Link>
                </div>

                <dl className="schools-metric-grid">
                  <div>
                    <dt>Active students</dt>
                    <dd>{row.activeStudents}</dd>
                  </div>
                  <div>
                    <dt>Assignment in focus</dt>
                    <dd className="schools-metric-text">{row.focusAssignment?.roleId ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd className="schools-metric-text">
                      {row.focusAssignment ? formatDate(row.focusAssignment.dueAt) : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{row.submitted}</dd>
                  </div>
                  <div>
                    <dt>Awaiting review</dt>
                    <dd>{row.notReviewed}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </section>
      )}

      {showProgrammeModal && (
        <ProgrammeModal
          institutionId={institutionId}
          onClose={() => setShowProgrammeModal(false)}
        />
      )}

      {showCohortModal && (
        <CohortModal
          institutionId={institutionId}
          programmes={programmes}
          onClose={() => setShowCohortModal(false)}
        />
      )}
    </>
  );
}
