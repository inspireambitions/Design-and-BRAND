'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INSTITUTIONAL_INDUSTRIES, STANDARD_INSTITUTIONAL_COMPETENCIES, extractCompetenciesWithMetadata } from '@/lib/schools/types';

type Question = {
  id: string;
  role_id: string;
  question_text: string;
  rubric: { id: string; label: string; description: string }[];
};

export function SchoolsAssign({
  cohortId,
  questions,
}: {
  cohortId: string;
  questions: Question[];
}) {
  const roles = [...new Set(questions.map((q) => q.role_id))];
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [industry, setIndustry] = useState<string>('finance');
  const [role, setRole] = useState(roles[0] ?? 'General');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [competencies, setCompetencies] = useState('Communication, Problem Solving, Professionalism');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [search, setSearch] = useState('');
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const pool = questions.filter((q) => !role || q.role_id === role || role === 'General');

  // Default to 3 questions, allow 3 to 8
  const [chosen, setChosen] = useState<string[]>(
    pool.slice(0, 3).map((q) => q.id)
  );

  const [due, setDue] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [deliveryMode, setDeliveryMode] = useState<'form_v1' | 'adaptive_v2'>('form_v1');
  const [maxAttempts, setMaxAttempts] = useState<number | ''>(3);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleAddQuestionSlot = () => {
    if (chosen.length >= 8) return;
    const remaining = pool.find((q) => !chosen.includes(q.id));
    if (remaining) {
      setChosen([...chosen, remaining.id]);
    } else if (pool.length > 0) {
      setChosen([...chosen, pool[0].id]);
    }
  };

  const handleRemoveQuestionSlot = (index: number) => {
    if (chosen.length <= 3) return;
    setChosen(chosen.filter((_, idx) => idx !== index));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= chosen.length) return;
    const copy = [...chosen];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setChosen(copy);
  };

  const handleSuggestCompetencies = () => {
    if (!jobDescription || jobDescription.trim().length < 15) {
      setMessage('Please paste a job description or key responsibilities first.');
      return;
    }
    const { competencies: extracted, arabicDetected } = extractCompetenciesWithMetadata(jobDescription);
    if (arabicDetected && extracted.length === 0) {
      setMessage('Automated keyword suggestions are not available for Arabic job descriptions. Please select or enter competencies manually, or let Muqabala propose them using the interview context.');
      return;
    }
    if (extracted.length === 0) {
      setMessage('No strong competency suggestions found. Add competencies manually or let Muqabala propose them using the interview context.');
      return;
    }
    const existing = competencies
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const combined = Array.from(new Set([...existing, ...extracted])).join(', ');
    setCompetencies(combined);
    setMessage(`Suggested ${extracted.length} competencies based on the job description. Edit or add more as needed.`);
  };

  const isStep1Valid = !!industry && !!role;
  const isStep2Valid = competencies.trim().length > 0;
  const isStep3Valid = chosen.length >= 3 && chosen.length <= 8 && new Set(chosen).size === chosen.length;
  const isStep4Valid = !!due;

  return (
    <div className="schools-card" style={{ maxWidth: '840px', margin: '20px auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#075c50', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Assignment Builder
        </span>
        <h2 style={{ margin: '6px 0 12px' }}>Multi-Industry Career Assignment</h2>
        <p style={{ color: '#4a5568', margin: 0 }}>
          Create structured, evidence-based interview assignments across any academic programme or industry sector.
        </p>
      </div>

      {/* Stepper Navigation */}
      <nav aria-label="Assignment progress" style={{ display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', overflowX: 'auto' }}>
        {[
          { num: 1, label: '1. Track & Role' },
          { num: 2, label: '2. JD & Competencies' },
          { num: 3, label: '3. Questions' },
          { num: 4, label: '4. Schedule & Publish' },
        ].map((s) => {
          const active = step === s.num;
          const completed = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as 1 | 2 | 3 | 4)}
              style={{
                flex: '1 1 auto',
                minWidth: '130px',
                padding: '10px 14px',
                borderRadius: '6px',
                border: active ? '2px solid #075c50' : completed ? '1px solid #9eb8ac' : '1px solid #e2e8f0',
                background: active ? '#075c50' : completed ? '#eef4ec' : '#fff',
                color: active ? '#fff' : completed ? '#075c50' : '#718096',
                fontWeight: active ? 'bold' : 'normal',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <form
        method="post"
        onSubmit={async (event) => {
          event.preventDefault();
          if (step < 4) {
            setStep((step + 1) as 2 | 3 | 4);
            return;
          }
          setBusy(true);
          try {
            const payload = {
              cohortId,
              roleId: role || 'General',
              questionIds: chosen,
              dueAt: new Date(due + 'T23:59:00Z').toISOString(),
              industry,
              jobTitle: jobTitle.trim() || undefined,
              jobDescription: jobDescription.trim() || undefined,
              instructions: instructions.trim() || undefined,
              status,
              deliveryMode,
              competencies: competencies
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
              maxAttempts: maxAttempts === '' ? undefined : Number(maxAttempts),
            };

            const response = await fetch('/api/schools/manage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operation: 'assignment', payload }),
            });

            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            router.push('/schools/cohorts/' + cohortId);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not assign.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {/* STEP 1: CAREER TRACK & ROLE */}
        {step === 1 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#163e39' }}>
              Step 1: Select Career Track &amp; Target Role
            </legend>
            <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '16px' }}>
              Choose the occupational sector and role family. This tailors the interview questions and evaluation context.
            </p>

            <label>
              Industry / Occupational Sector
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {INSTITUTIONAL_INDUSTRIES.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.labelEn} — {ind.labelAr}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Role Category
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  const matching = questions.filter((q) => q.role_id === e.target.value);
                  if (matching.length >= 3) {
                    setChosen(matching.slice(0, 3).map((q) => q.id));
                  }
                }}
              >
                <option value="General">General Career / Multi-Industry Foundations</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Target Job Title (optional)
              <input
                type="text"
                placeholder="e.g. Graduate Analyst, Trainee Solicitor, Nurse, Associate Consultant"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={160}
              />
              <span style={{ fontSize: '12px', color: '#718096' }}>
                Students see this on their dashboard and practice workspace.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" disabled={!isStep1Valid} onClick={() => setStep(2)}>
                Continue to Step 2: JD &amp; Competencies &rarr;
              </button>
            </div>
          </fieldset>
        )}

        {/* STEP 2: JOB DESCRIPTION & COMPETENCIES */}
        {step === 2 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#163e39' }}>
              Step 2: Role Details &amp; Target Competencies
            </legend>
            <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '16px' }}>
              Optionally provide employer job advert text or career guidance to tailor student expectations and automatically suggest target competencies.
            </p>

            <label>
              Job Description / Employer Role Advert (optional)
              <textarea
                placeholder="Paste real employer job advert or requirements to extract relevant competencies..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </label>

            {jobDescription.trim().length >= 20 && (
              <button
                type="button"
                onClick={handleSuggestCompetencies}
                style={{
                  background: '#eef4ec',
                  color: '#075c50',
                  border: '1px solid #9eb8ac',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                ✨ Suggest Target Competencies from Job Description
              </button>
            )}

            <label>
              Target Competencies (comma-separated, editable)
              <input
                type="text"
                value={competencies}
                onChange={(e) => setCompetencies(e.target.value)}
                maxLength={300}
              />
              <span style={{ fontSize: '12px', color: '#718096' }}>
                Standard institutional competencies: Analytical Thinking, Communication, Teamwork, Problem Solving, Leadership, Commercial Awareness.
              </span>
            </label>

            {/* Competency Quick-Add Badges */}
            <div style={{ marginTop: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: '6px' }}>
                Quick-add standard institutional competencies:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {STANDARD_INSTITUTIONAL_COMPETENCIES.slice(0, 6).map((comp) => {
                  const already = competencies.toLowerCase().includes(comp.label.toLowerCase());
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      disabled={already}
                      onClick={() => {
                        const current = competencies
                          .split(',')
                          .map((c) => c.trim())
                          .filter(Boolean);
                        setCompetencies([...current, comp.label].join(', '));
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: already ? '#edf2f7' : '#fff',
                        color: already ? '#a0aec0' : '#2d3748',
                        border: '1px solid #cbd5e0',
                        cursor: already ? 'default' : 'pointer',
                      }}
                    >
                      {already ? '✓ ' + comp.label : '+ ' + comp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              Adviser Guidance / Instructions to Cohort (optional)
              <textarea
                placeholder="e.g. Please complete this interview practice before Tuesday's career advisory workshop. Focus your examples on your graduation project or part-time employment."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: '#e2e8f0', color: '#2d3748' }}>
                &larr; Back
              </button>
              <button type="button" disabled={!isStep2Valid} onClick={() => setStep(3)}>
                Continue to Step 3: Question Selection &rarr;
              </button>
            </div>
          </fieldset>
        )}

        {/* STEP 3: QUESTION SELECTION & PREVIEW */}
        {step === 3 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#163e39' }}>
              Step 3: Interview Questions ({chosen.length} of 3–8)
            </legend>
            <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '16px' }}>
              Select 3 to 8 vetted interview questions. You can reorder, swap, or search the institutional question bank.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <input
                  type="search"
                  placeholder="Search questions or keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ margin: 0 }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPreview(!showStudentPreview)}
                style={{
                  background: showStudentPreview ? '#075c50' : '#eef4ec',
                  color: showStudentPreview ? '#fff' : '#075c50',
                  border: '1px solid #9eb8ac',
                  fontSize: '13px',
                }}
              >
                {showStudentPreview ? 'Hide Student Preview' : '👁 Preview as Student'}
              </button>
            </div>

            {/* STUDENT PREVIEW CARD */}
            {showStudentPreview && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '2px dashed #94a3b8',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
                  Student View Preview
                </span>
                <h3 style={{ margin: '4px 0 8px', fontSize: '18px' }}>
                  {jobTitle || role || 'General Career Readiness'}
                </h3>
                {instructions && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                    <strong>Adviser Note:</strong> {instructions}
                  </div>
                )}
                <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 12px' }}>
                  {chosen.length} questions • Private evaluation against evidence rubric
                </p>
                <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: '#334155' }}>
                  {chosen.map((id, idx) => {
                    const q = pool.find((item) => item.id === id);
                    return (
                      <li key={idx} style={{ marginBottom: '6px' }}>
                        {q ? q.question_text : <em>Question not found</em>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* QUESTION SLOTS */}
            {chosen.map((chosenId, index) => {
              const question = pool.find((q) => q.id === chosenId);
              return (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: '12px',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#075c50' }}>
                      Question {index + 1}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveQuestion(index, 'up')}
                        title="Move Up"
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '4px' }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === chosen.length - 1}
                        onClick={() => handleMoveQuestion(index, 'down')}
                        title="Move Down"
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '4px' }}
                      >
                        ▼
                      </button>
                      {chosen.length > 3 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionSlot(index)}
                          style={{ background: 'transparent', color: '#e53e3e', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <select
                    aria-label={'Choose question ' + (index + 1)}
                    value={chosenId}
                    onChange={(e) => {
                      const next = [...chosen];
                      next[index] = e.target.value;
                      setChosen(next);
                    }}
                    style={{ marginBottom: '8px' }}
                  >
                    <option value="">Select an approved question</option>
                    {pool
                      .filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase()))
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.question_text}
                        </option>
                      ))}
                  </select>

                  {question && (
                    <details style={{ fontSize: '12px', color: '#4a5568', marginTop: '6px' }}>
                      <summary style={{ cursor: 'pointer', color: '#075c50' }}>
                        View rubric evidence criteria ({question.rubric.length} elements)
                      </summary>
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        {question.rubric.map((element) => (
                          <li key={element.id} style={{ marginBottom: '3px' }}>
                            <strong>{element.label}</strong>: {element.description}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}

            {chosen.length < 8 && (
              <button
                type="button"
                onClick={handleAddQuestionSlot}
                style={{
                  background: '#f8fafc',
                  color: '#075c50',
                  border: '1px dashed #9eb8ac',
                  width: '100%',
                  padding: '10px',
                  marginBottom: '16px',
                }}
              >
                + Add Another Question (up to 8 slots)
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep(2)} style={{ background: '#e2e8f0', color: '#2d3748' }}>
                &larr; Back
              </button>
              <button type="button" disabled={!isStep3Valid} onClick={() => setStep(4)}>
                Continue to Step 4: Schedule &amp; Publish &rarr;
              </button>
            </div>
          </fieldset>
        )}

        {/* STEP 4: SCHEDULE & PUBLISH */}
        {step === 4 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#163e39' }}>
              Step 4: Schedule, Attempt Limits &amp; Publish
            </legend>
            <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '16px' }}>
              Set student submission deadlines, practice attempt allowances, and choose whether to publish immediately or save as a draft.
            </p>

            <label>
              Assignment Status
              <select value={status} onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}>
                <option value="published">Published — Immediately active &amp; visible in student inboxes</option>
                <option value="draft">Draft — Private to educators until explicitly published</option>
              </select>
            </label>

            <label>
              Interview Delivery Format
              <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as 'form_v1' | 'adaptive_v2')}>
                <option value="form_v1">Standard Written Form — Simultaneous multi-question written assignment with autosave</option>
                <option value="adaptive_v2">Adaptive Conversational Interview (Recommended) — One question at a time with AI follow-up probing and experience fallbacks</option>
              </select>
              <span style={{ fontSize: '12px', color: '#718096' }}>
                {deliveryMode === 'adaptive_v2'
                  ? 'The Universal Engine adapts probing and offers student experience fallbacks while strictly evaluating against your approved rubric.'
                  : 'Traditional assignment format where learners draft and submit all written answers at once.'}
              </span>
            </label>

            <label>
              Due Date (End of day UTC)
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
            </label>

            <label>
              Maximum Practice Attempts per Student (1–20, or blank for unlimited)
              <input
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span style={{ fontSize: '12px', color: '#718096' }}>
                Students can practice multiple attempts and compare their own development between revisions.
              </span>
            </label>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '12px 16px',
                fontSize: '0.85rem',
                color: '#475569',
                margin: '20px 0',
              }}
            >
              <strong>Assessment Immutability Notice:</strong> Once any student submits an attempt, assessment questions, role, competencies, and maximum attempts are permanently locked to preserve evaluation integrity. Due dates, instructions, and publishing status can still be edited at any time.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep(3)} style={{ background: '#e2e8f0', color: '#2d3748' }}>
                &larr; Back
              </button>
              <button
                type="submit"
                disabled={
                  busy ||
                  !isStep4Valid ||
                  chosen.length < 3 ||
                  chosen.length > 8 ||
                  new Set(chosen).size !== chosen.length
                }
              >
                {busy
                  ? 'Saving assignment...'
                  : status === 'draft'
                  ? 'Save Draft Assignment'
                  : 'Publish Career Assignment'}
              </button>
            </div>
          </fieldset>
        )}

        {message && (
          <p role="status" style={{ marginTop: '16px', color: message.includes('suggested') || message.includes('Suggested') ? '#075c50' : '#c53030' }}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

export function SchoolsQuestionEditor({
  cohortId,
  roles,
}: {
  cohortId: string;
  roles: { id: string; title: string }[];
}) {
  const [message, setMessage] = useState('');
  const router = useRouter();

  return (
    <details className="schools-card">
      <summary>Approve a custom question for the institutional bank</summary>
      <form
        method="post"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload = {
            cohortId,
            roleId: form.get('role'),
            text: form.get('question'),
            followUp: form.get('followUp'),
            rubric: [0, 1, 2, 3].map((i) => ({
              id: 'e' + i,
              label: String(form.get('label' + i)),
              description: String(form.get('description' + i)),
            })),
          };
          try {
            const response = await fetch('/api/schools/manage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operation: 'question', payload }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            setMessage('Question version saved.');
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save.');
          }
        }}
      >
        <label>
          Role / Career Track
          <select name="role">
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Question Text
          <textarea name="question" required maxLength={1200} />
        </label>
        {[0, 1, 2, 3].map((i) => (
          <fieldset key={i}>
            <legend>Competency rubric element {i + 1}</legend>
            <label>
              Element name (e.g. Problem Solving, Metric Evidence)
              <input name={'label' + i} required maxLength={200} />
            </label>
            <label>
              Evidence to look for in student answer
              <textarea name={'description' + i} required maxLength={600} />
            </label>
          </fieldset>
        ))}
        <label>
          Follow-up prompt if student cannot think of an example
          <textarea name="followUp" required maxLength={800} />
        </label>
        <p>Assess evidence in student responses. Never assess personal traits or supply a finished answer.</p>
        <button>Approve Question Version</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
