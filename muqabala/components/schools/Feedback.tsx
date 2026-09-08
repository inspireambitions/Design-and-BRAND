'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { schoolsFeedbackSchema } from '@/lib/schools/evidence';
import Link from 'next/link';
export function SchoolsFeedback({attemptId,status,detail,covered,assignmentId,rubrics,onRetry,retryBusy}:{attemptId:string;status:string;detail:unknown;covered:number|null;assignmentId?:string;rubrics?:{id:string;label:string}[][];onRetry?:(question:number)=>void;retryBusy?:boolean}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [result,setResult]=useState({status,detail,covered});
  const [cycle,setCycle]=useState(0);
  const ready=result.status==='ready'||status==='ready';
  const started=useRef<string|null>(null);
  useEffect(()=>{
    if(status==='ready'){setResult({status,detail,covered});return;}
    let stopped=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const deadline=Date.now()+120000;
    setBusy(true);setMessage('Preparing your feedback. Allow up to two minutes. Your answers are saved.');
    const check=async()=>{
      try{
        const response=await fetch('/api/schools/feedback?attemptId='+attemptId,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        if(response.status===401){if(!stopped){setBusy(false);setMessage('Sign in again to read your saved feedback.');}return;}
        if(!response.ok)throw new Error();
        const next=await response.json();if(stopped)return;
        if(next.feedback_status==='ready'){setResult({status:'ready',detail:next.evidence_detail,covered:next.evidence_covered});setBusy(false);router.refresh();return;}
        if(next.feedback_status==='failed'){setBusy(false);setMessage('Feedback could not finish. Your answers are saved. Try again.');return;}
      }catch{if(stopped)return;}
      if(Date.now()>=deadline){setBusy(false);setMessage('This is taking longer than expected. Your answers are saved. Check again or return later.');return;}
      timer=setTimeout(check,4000);
    };
    // One generation request per visit or explicit retry. Status checks never call the AI service.
    const key=attemptId+':'+cycle;
    if(started.current!==key){started.current=key;void fetch('/api/schools/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attemptId}),signal:AbortSignal.timeout(55000)}).catch(()=>{});}
    timer=setTimeout(check,4000);
    return()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[attemptId,status,cycle,router]);
  if(!ready)return <section className="schools-card" aria-busy={busy}><h2>Your feedback</h2>
    <p role="status">{message||'Preparing your feedback. Your answers are saved.'}</p>
    {busy?<progress aria-label="Preparing your feedback"/>:<button onClick={()=>setCycle(value=>value+1)}>Check feedback again</button>}
    </section>;
  detail=status==='ready'?detail:result.detail;covered=status==='ready'?covered:result.covered;
  // Stored detail contains highlight offsets in addition to the provider contract.
  const raw=Array.isArray(detail)?detail.map(q=>({...q,elements:q.elements?.map((e:Record<string,unknown>)=>({id:e.id,present:e.present,supportingText:e.supportingText,confidence:e.confidence}))})):null;
  const parsed=schoolsFeedbackSchema.safeParse({questions:raw});
  if(!parsed.success)return <p>Feedback is temporarily unavailable. Your answers are saved.</p>;
  const first=parsed.data.questions.slice().sort((a,b)=>a.elements.filter(e=>e.present).length-b.elements.filter(e=>e.present).length||a.questionIndex-b.questionIndex)[0];
  return <section className="schools-card"><h2>Your private feedback</h2><p>Evidence covered: {covered} of 12 elements</p>
    <h3>Add this first</h3><p>{first.improvement}</p>
    {onRetry?<button disabled={retryBusy} onClick={()=>onRetry(first.questionIndex+1)}>{retryBusy?'Opening your new draft...':'Retry question '+(first.questionIndex+1)}</button>:assignmentId&&<Link href={'/schools/me/'+assignmentId+'?retry='+(first.questionIndex+1)}>Retry question {first.questionIndex+1}</Link>}
    {parsed.data.questions.map(q=><section key={q.questionIndex}><h3>Question {q.questionIndex+1}</h3><ul>{q.elements.map(e=><li key={e.id}>
      <strong>{rubrics?.[q.questionIndex]?.find(element=>element.id===e.id)?.label??e.id}: {e.present?'Present':'Absent'}</strong>.{e.confidence!=='high'&&<> Confidence: {e.confidence}.</>}
      {e.present&&<blockquote><mark>{e.supportingText}</mark></blockquote>}</li>)}</ul><p>{q.improvement}</p></section>)}
    <p>Evidence covered counts the rubric elements present in your answer. It is not a score of you and does not predict any hiring decision.</p></section>;
}
