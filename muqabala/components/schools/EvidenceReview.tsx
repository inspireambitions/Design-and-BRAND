'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SchoolRubric } from '@/lib/schools/evidence';

type Element={id:string;present:boolean;supportingText:string;confidence:string};
type Question={questionIndex:number;elements:Element[];improvement:string};
type Correction={question_index:number;rubric_element:string;corrected_present:boolean;reason:string;created_at:string};

export function SchoolsEvidenceReview({attemptId,answers,questions,detail,corrections,firstAnswers}:{
  attemptId:string;answers:string[];questions:{text:string;rubric:SchoolRubric}[];
  detail:Question[]|null;corrections:Correction[];firstAnswers:string[]|null;
}) {
  const router=useRouter();const [compare,setCompare]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function correct(question:number,element:Element) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operation:'correct',payload:{attemptId,question,element:element.id,present:!element.present,reason}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      setEditing(null);setReason('');router.refresh();
    }catch(error){setError(error instanceof Error?error.message:'Could not save the correction.');}
    finally{setBusy(false);}
  }
  return <section aria-label="Submitted answer evidence">
    {firstAnswers&&<label><input type="checkbox" checked={compare} onChange={event=>setCompare(event.target.checked)}/> Compare with attempt 1</label>}
    {error&&<p role="alert">{error}</p>}
    {questions.map((question,index)=><section className="schools-card" key={index}>
      <h2>Question {index+1}: {question.text}</h2><h3>Submitted answer</h3><p style={{whiteSpace:'pre-wrap'}}>{answers[index]}</p>
      {compare&&firstAnswers&&<><h3>Attempt 1</h3><p style={{whiteSpace:'pre-wrap'}}>{firstAnswers[index]}</p></>}
      {!detail&&<p>Evidence is awaiting feedback processing.</p>}
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
    </section>)}
  </section>;
}
