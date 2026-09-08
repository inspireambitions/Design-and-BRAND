'use client';
import { useEffect, useRef, useState } from 'react';
import { SchoolsFeedback } from './Feedback';
import { useRouter } from 'next/navigation';
type Attempt={id:string;status:string;answers:string[];revision:number;attempt_number:number;feedback_status:string;evidence_detail:unknown;evidence_covered:number|null};
export function SchoolsPractice({assignmentId,cohortId,questions,initial,dueAt,retryQuestion}:{
  assignmentId:string;cohortId:string;questions:{text:string;followUp:string}[];initial:Attempt|null;dueAt:string;retryQuestion?:number;
}) {
  const router=useRouter();
  const [answers,setAnswers]=useState<string[]>(initial?.answers??['','','']);
  const [attempt,setAttempt]=useState(initial);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [prompts,setPrompts]=useState<number|null>(null);
  const latest=useRef(answers); latest.current=answers;
  const stored=useRef(initial?.answers??['','','']);
  const version=useRef(initial);
  const pendingId=useRef<string|null>(initial?.id??null);
  const locked=useRef(false);
  const closed=Date.now()>=new Date(dueAt).getTime();
  const submitted=attempt?.status==='submitted';
  useEffect(()=>{if(!submitted&&retryQuestion)document.getElementById('answer-'+(retryQuestion-1))?.focus();},[submitted,retryQuestion]);
  async function save(submit=false) {
    if(locked.current||submitted||closed) return;
    if(!submit&&JSON.stringify(latest.current)===JSON.stringify(stored.current)) return;
    locked.current=true;setBusy(true);setError('');
    const snapshot=[...latest.current];
    pendingId.current??=crypto.randomUUID();
    try {
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operation:submit?'submit':'draft',payload:{assignmentId,attemptId:version.current?.id??pendingId.current,revision:version.current?.revision??0,answers:snapshot}}),
        signal:AbortSignal.timeout(25000)});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||'Could not save. Retry without closing this page.');
      version.current=body.result;stored.current=snapshot;setAttempt(body.result);
      setMessage(submit?'Your answers have been submitted.':'Draft saved.');
    } catch(e) {setError(e instanceof Error?e.message:'Could not save. Keep this page open and retry.');}
    finally {locked.current=false;setBusy(false);}
  }
  const saveLatest=useRef(save);saveLatest.current=save;
  useEffect(()=>{const timer=setInterval(()=>void saveLatest.current(),10000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(JSON.stringify(latest.current)!==JSON.stringify(stored.current)){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  return <><p role="status" aria-live="polite">{message}</p>{error&&<p role="alert">{error}</p>}
    {submitted?<section className="schools-card"><h2>Your answers are saved</h2><p>Attempt {attempt.attempt_number}. {attempt.feedback_status==='ready'?'Your feedback is available.':'Your feedback is awaiting processing. Your submitted answers are safe.'}</p></section>:null}
    {submitted&&<SchoolsFeedback attemptId={attempt.id} status={initial?.id===attempt.id?initial.feedback_status:attempt.feedback_status} detail={initial?.id===attempt.id?initial.evidence_detail:attempt.evidence_detail} covered={initial?.id===attempt.id?initial.evidence_covered:attempt.evidence_covered}/>}
    {submitted&&!closed&&<button disabled={busy} onClick={async()=>{setBusy(true);try{
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'retry',payload:{attemptId:attempt.id}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      version.current=body.result;stored.current=body.result.answers;setAnswers(body.result.answers);setAttempt(body.result);router.refresh();
    }catch(error){setError(error instanceof Error?error.message:'Could not start a retry.');}finally{setBusy(false);}}}>{retryQuestion?'Retry question '+retryQuestion:'Start a new attempt'}</button>}
    {questions.map((question,index)=><fieldset key={index}><legend>Question {index+1}: {question.text}</legend>
      <label htmlFor={'answer-'+index}>Your answer</label><textarea id={'answer-'+index} rows={8} maxLength={12000} value={answers[index]} disabled={submitted||closed}
        onChange={e=>{const next=[...answers];next[index]=e.target.value;setAnswers(next);}} onBlur={()=>void save()}/>
      {!submitted&&<button type="button" onClick={()=>setPrompts(prompts===index?null:index)} aria-expanded={prompts===index}>I cannot think of an example</button>}
      {prompts===index&&<div className="schools-card"><p>Think about one of these experiences:</p><ul>
        <li>Coursework or projects</li><li>Volunteering or community</li><li>Caring or family responsibilities</li><li>Part-time or casual work</li></ul>
        <p>{question.followUp}</p><p>Write what you did in your own words.</p></div>}
    </fieldset>)}
    {!submitted&&<div className="schools-actions"><button disabled={busy||closed} onClick={()=>void save()}>Save draft</button>
      <button disabled={busy||closed||answers.some(a=>!a.trim())} onClick={()=>void save(true)}>Submit answers</button></div>}
    {closed&&!submitted&&<p>The due date has passed. Ask your adviser for help.</p>}
    <p>Your adviser can read what you submit. Drafts are private.</p>
    <button onClick={async()=>{try{const r=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'support',payload:{cohortId}})});if(!r.ok)throw new Error();setMessage('Your support request is open.');}catch{setError('Could not request support. Please try again.');}}}>Request adviser support</button>
  </>;
}
