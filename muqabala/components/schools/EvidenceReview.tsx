'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SchoolRubric } from '@/lib/schools/evidence';
import { detectAttemptReviewExceptions } from '@/lib/schools/review-exceptions';

type Element={id:string;present:boolean;supportingText:string;confidence:string};
type Question={questionIndex:number;elements:Element[];improvement:string};
type Correction={question_index:number;rubric_element:string;corrected_present:boolean;reason:string;created_at:string};

type AdaptiveTurn = {
  turnNumber: number;
  questionNumber: number;
  questionText: string;
  answerText: string;
  action: string;
  timestamp: string;
};

type EvidenceItem = {
  id: string;
  question_number: number;
  summary: string;
  evidence_type: string;
  competencies: Record<string, string>;
  criteria: Record<string, string>;
};

export function SchoolsEvidenceReview({
  attemptId,
  answers,
  questions,
  detail,
  corrections,
  firstAnswers,
  deliveryMode,
  adaptiveTurns,
  evidenceLedger,
}: {
  attemptId: string;
  answers: string[];
  questions: { text: string; rubric: SchoolRubric }[];
  detail: Question[] | null;
  corrections: Correction[];
  firstAnswers: string[] | null;
  deliveryMode?: string;
  adaptiveTurns?: AdaptiveTurn[] | null;
  evidenceLedger?: EvidenceItem[] | null;
}) {
  const router=useRouter();const [compare,setCompare]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function correct(question:number,element:Element) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operation:'correct',payload:{attemptId,question,element:element.id,present:!element.present,reason,revision:corrections.length}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      setEditing(null);setReason('');router.refresh();
    }catch(error){setError(error instanceof Error?error.message:'Could not save the correction.');}
    finally{setBusy(false);}
  }
  const totalPossible = questions.length * 4;
  const coveredCount = detail
    ? detail.reduce((acc, q) => acc + q.elements.filter((e) => e.present).length, 0)
    : null;

  const exceptions = detectAttemptReviewExceptions({
    answers,
    evidenceCovered: coveredCount,
    totalPossible,
    adaptiveTurns,
  });

  return (
    <section aria-label="Submitted answer evidence">
      {/* ADVISER REVIEW BY EXCEPTION SIGNALS */}
      {exceptions.length > 0 ? (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#92400e' }}>
            Adviser Review Exceptions ({exceptions.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#78350f' }}>
            {exceptions.map((ex, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>
                <strong>{ex.label}:</strong> {ex.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#166534',
          }}
        >
          <strong>Review Status:</strong> No exceptions flagged. Candidate answers meet length thresholds and standard evidence criteria.
        </div>
      )}

      {firstAnswers && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
            <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />{' '}
            Compare side-by-side with attempt 1
          </label>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {questions.map((question, index) => {
        const questionTurns = adaptiveTurns?.filter((t) => t.questionNumber === index + 1) || [];
        const questionEvidence = evidenceLedger?.find((e) => e.question_number === index + 1);

        return (
          <section className="schools-card" key={index}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0 }}>Question {index + 1}: {question.text}</h2>
              {deliveryMode === 'adaptive_v2' && (
                <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', background: '#dcfce7', color: '#166534' }}>
                  Adaptive Interview
                </span>
              )}
            </div>

            {questionEvidence && (
              <div style={{ margin: '8px 0 14px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background:
                      questionEvidence.evidence_type === 'HYPOTHETICAL'
                        ? '#f3e8ff'
                        : questionEvidence.evidence_type === 'ACADEMIC'
                        ? '#e0f2fe'
                        : '#f0fdf4',
                    color:
                      questionEvidence.evidence_type === 'HYPOTHETICAL'
                        ? '#6b21a8'
                        : questionEvidence.evidence_type === 'ACADEMIC'
                        ? '#0369a1'
                        : '#15803d',
                  }}
                >
                  {questionEvidence.evidence_type === 'HYPOTHETICAL'
                    ? 'Situational Reasoning (Hypothetical)'
                    : questionEvidence.evidence_type === 'ACADEMIC'
                    ? 'Transferable Evidence (Academic / Project)'
                    : questionEvidence.evidence_type === 'EMPLOYMENT' || questionEvidence.evidence_type === 'INTERNSHIP'
                    ? 'Demonstrated Direct Evidence'
                    : `Evidence Type: ${questionEvidence.evidence_type}`}
                </span>
              </div>
            )}

            {/* ATTEMPT COMPARISON (Desktop side-by-side, mobile stacked) */}
            {compare && firstAnswers ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  margin: '12px 0 16px',
                  padding: '14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#64748b' }}>Attempt 1 (Previous)</h4>
                  <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#334155' }}>
                    {firstAnswers[index] || '(No response recorded)'}
                  </p>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#075c50' }}>Current Attempt (Revision)</h4>
                  <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#0f172a' }}>
                    {answers[index] || '(No response recorded)'}
                  </p>
                </div>
              </div>
            ) : questionTurns.length > 1 ? (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#475569' }}>Conversational Turns &amp; Adaptive Probes</h4>
                {questionTurns.map((turn, tIdx) => (
                  <div key={tIdx} style={{ marginBottom: '10px', paddingBottom: tIdx < questionTurns.length - 1 ? '10px' : 0, borderBottom: tIdx < questionTurns.length - 1 ? '1px dashed #cbd5e1' : 'none' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 'bold', color: '#075c50' }}>
                      {tIdx === 0 ? 'Initial Response' : `Adaptive Follow-up Turn ${turn.turnNumber}: "${turn.questionText}"`}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{turn.answerText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <h3>Submitted answer</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{answers[index]}</p>
              </>
            )}
            {!detail && <p>Evidence is awaiting feedback processing.</p>}
      {question.rubric.map(rubric=>{
        const element=detail?.find(q=>q.questionIndex===index)?.elements.find(e=>e.id===rubric.id);
        const correction=corrections.filter(c=>c.question_index===index&&c.rubric_element===rubric.id).at(-1);
        const key=index+':'+rubric.id;
        return <div key={rubric.id}><h3>{rubric.label}{element?': '+(element.present?'Present':'Absent'):''}</h3><p>{rubric.description}</p>
          {element&&<><p>Engine confidence: {element.confidence}. {correction?'The adviser has corrected this element.':''}</p>
            {element.present&&element.supportingText&&<blockquote><mark>{element.supportingText}</mark></blockquote>}
            {correction&&<p>Adviser reason: {correction.reason}</p>}
            {element.present&&!element.supportingText&&<p>Present following adviser correction. The engine did not provide an excerpt.</p>}
            <button type="button" disabled={busy} onClick={()=>{setEditing(editing===key?null:key);setReason('');}} aria-expanded={editing===key}>Change to {element.present?'absent':'present'}</button>
            {editing===key&&<div><label htmlFor={'reason-'+index+'-'+rubric.id}>Reason for this correction</label>
              <textarea id={'reason-'+index+'-'+rubric.id} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/>
              <button type="button" disabled={busy||!reason.trim()} onClick={()=>void correct(index,element)}>Save correction</button></div>}
          </>}
        </div>;
      })}
      </section>
    );
    })}
  </section>
);
}
