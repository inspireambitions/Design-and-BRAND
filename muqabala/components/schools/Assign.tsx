'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INSTITUTIONAL_INDUSTRIES } from '@/lib/schools/types';

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
  const [industry, setIndustry] = useState<string>('finance');
  const [role, setRole] = useState(roles[0] ?? 'General');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [competencies, setCompetencies] = useState('Communication, Problem Solving, Professionalism');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [search, setSearch] = useState('');
  const pool = questions.filter((q) => !role || q.role_id === role || role === 'General');

  // Default to 3 questions, allow 3 to 8
  const [chosen, setChosen] = useState<string[]>(
    pool.slice(0, 3).map((q) => q.id)
  );

  const [due, setDue] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
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

  return (
    <form
      method="post"
      className="schools-card"
      onSubmit={async (event) => {
        event.preventDefault();
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
      <h2>Multi-Industry Career Assignment</h2>
      <p>Configure interview practice questions and career competencies for this cohort.</p>

      <fieldset>
        <legend>Career Field &amp; Role</legend>
        <label>
          Industry / Career Track
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
            <option value="General">General Career / Any Track</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label>
          Specific Target Job Title (optional)
          <input
            type="text"
            placeholder="e.g. Graduate Analyst, Junior Software Engineer, Staff Nurse"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={160}
          />
        </label>

        <label>
          Job Description / Role Guidance (optional)
          <textarea
            placeholder="Paste employer job advert or role description to tailor evaluation..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            maxLength={5000}
            rows={3}
          />
        </label>

        <label>
          Target Competencies (comma-separated)
          <input
            type="text"
            value={competencies}
            onChange={(e) => setCompetencies(e.target.value)}
            maxLength={200}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Adviser Instructions for Students</legend>
        <label>
          Guidance / Context (displayed prominently to students on their practice card)
          <textarea
            placeholder="e.g. Please complete this practice ahead of next Tuesday's career advisory workshop. Focus your examples on your graduation project or work placement."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Questions ({chosen.length} of 3–8)</legend>
        <label>
          Filter question bank
          <input
            type="search"
            placeholder="Search questions or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {chosen.map((chosenId, index) => {
          const question = pool.find((q) => q.id === chosenId);
          return (
            <div key={index} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Question {index + 1}</strong>
                {chosen.length > 3 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestionSlot(index)}
                    style={{ background: 'transparent', color: '#e53e3e', border: 'none', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <select
                aria-label={'Choose question ' + (index + 1)}
                value={chosenId}
                onChange={(e) => {
                  const next = [...chosen];
                  next[index] = e.target.value;
                  setChosen(next);
                }}
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
                <ul style={{ fontSize: '0.85rem', color: '#4a5568', marginTop: '0.5rem' }}>
                  {question.rubric.map((element) => (
                    <li key={element.id}>
                      <strong>{element.label}</strong>: {element.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {chosen.length < 8 && (
          <button type="button" onClick={handleAddQuestionSlot} style={{ marginBottom: '1rem' }}>
            + Add Another Question (up to 8)
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend>Assignment Lifecycle &amp; Attempts</legend>
        <label>
          Assignment Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}>
            <option value="published">Published — Immediately available to enrolled students</option>
            <option value="draft">Draft — Private to educators until explicitly published</option>
          </select>
        </label>

        <label>
          Due Date (End of day UTC)
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
        </label>

        <label>
          Maximum Practice Attempts (1–20, or blank for unlimited)
          <input
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </fieldset>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '12px 16px',
          fontSize: '0.85rem',
          color: '#475569',
          marginBottom: '1.25rem',
        }}
      >
        <strong>Assessment Immutability Notice:</strong> Once any student submits an attempt, assessment questions, role, competencies, and maximum attempts are permanently locked to preserve evaluation integrity. Due dates, instructions, and publishing status can still be edited at any time.
      </div>

      <button
        disabled={
          busy ||
          chosen.length < 3 ||
          chosen.length > 8 ||
          new Set(chosen).size !== chosen.length
        }
      >
        {busy ? 'Saving assignment...' : status === 'draft' ? 'Save Draft Assignment' : 'Publish Career Assignment'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
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
