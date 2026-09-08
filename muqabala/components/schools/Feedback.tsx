'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { schoolsFeedbackSchema } from '@/lib/schools/evidence';
import Link from 'next/link';
export function SchoolsFeedback({attemptId,status,detail,covered,assignmentId,rubrics}:{attemptId:string;status:string;detail:unknown;covered:number|null;assignmentId?:string;rubrics?:{id:string;label:string}[][]}) {
  const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  if(status!=='ready')return <section className="schools-card"><h2>Your feedback</h2><p>Your submitted answers are saved.</p>
    <button disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/schools/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attemptId}),signal:AbortSignal.timeout(50000)});if(!response.ok&&response.status!==202)throw new Error();const result=await response.json();setMessage(result.ready?'Feedback is ready.':'Feedback is not ready yet. You can return later.');router.refresh();}catch{setMessage('Could not load feedback. Your answers are saved. Try again later.');}finally{setBusy(false);}}}>Read your feedback</button><p role="status">{message}</p></section>;
  // Stored detail contains highlight offsets in addition to the provider contract.
  const raw=Array.isArray(detail)?detail.map(q=>({...q,elements:q.elements?.map((e:Record<string,unknown>)=>({id:e.id,present:e.present,supportingText:e.supportingText,confidence:e.confidence}))})):null;
  const parsed=schoolsFeedbackSchema.safeParse({questions:raw});
  if(!parsed.success)return <p>Feedback is temporarily unavailable. Your answers are saved.</p>;
  const first=parsed.data.questions.slice().sort((a,b)=>a.elements.filter(e=>e.present).length-b.elements.filter(e=>e.present).length||a.questionIndex-b.questionIndex)[0];
  return <section className="schools-card"><h2>Your private feedback</h2><p>Evidence covered: {covered} of 12 elements</p>
    <h3>Add this first</h3><p>{first.improvement}</p>
    {assignmentId&&<Link href={'/schools/me/'+assignmentId+'?retry='+(first.questionIndex+1)}>Retry question {first.questionIndex+1}</Link>}
    {parsed.data.questions.map(q=><section key={q.questionIndex}><h3>Question {q.questionIndex+1}</h3><ul>{q.elements.map(e=><li key={e.id}>
      <strong>{rubrics?.[q.questionIndex]?.find(element=>element.id===e.id)?.label??e.id}: {e.present?'Present':'Absent'}</strong>. Engine confidence: {e.confidence}.
      {e.present&&<blockquote><mark>{e.supportingText}</mark></blockquote>}</li>)}</ul><p>{q.improvement}</p></section>)}
    <p>Evidence covered counts the rubric elements present in your answer. It is not a score of you and does not predict any hiring decision.</p></section>;
}
