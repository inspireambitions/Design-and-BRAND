'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SchoolsFeedback } from './Feedback';
type Attempt={id:string;status:string;answers:string[];revision:number;attempt_number:number;feedback_status:string;evidence_detail:unknown;evidence_covered:number|null};
export function SchoolsPractice({assignmentId,cohortId,questions,initial,dueAt,retryQuestion,maxAttempts}:{
  assignmentId:string;cohortId:string;questions:{text:string;followUp:string;rubric:{id:string;label:string}[]}[];initial:Attempt|null;dueAt:string;retryQuestion?:number;maxAttempts?:number|null;
}) {
  const defaultAnswers=initial?.answers&&initial.answers.length===questions.length?initial.answers:Array.from({length:questions.length},(_,i)=>initial?.answers?.[i]??'');
  const [answers,setAnswers]=useState<string[]>(defaultAnswers);
  const [attempt,setAttempt]=useState(initial);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [prompts,setPrompts]=useState<number|null>(null);
  const latest=useRef(answers);
  const stored=useRef(defaultAnswers);
  const version=useRef(initial);
  const pendingId=useRef<string|null>(initial?.id??null);
  const locked=useRef(false);
  const queuedSubmission=useRef(false);
  // Due-date enforcement intentionally compares against the current request/render time.
  // eslint-disable-next-line react-hooks/purity
  const closed=Date.now()>=new Date(dueAt).getTime();
  const submitted=attempt?.status==='submitted';
  // Mirrors the server rule in schools_retry: no new attempt once max_attempts is used up.
  const attemptsExhausted=maxAttempts!=null&&(attempt?.attempt_number??0)>=maxAttempts;
  useEffect(()=>{if(!submitted&&retryQuestion)document.getElementById('answer-'+(retryQuestion-1))?.focus();},[submitted,retryQuestion]);
  const retryStarted=useRef(false);
  const startRetry=useCallback(async (question?:number) => {
    if(locked.current||!attempt||closed||attemptsExhausted)return;
    locked.current=true;setBusy(true);setError('');
    try {
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'retry',payload:{attemptId:attempt.id}}),signal:AbortSignal.timeout(25000)});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not start a retry. Please try again.');
      version.current=body.result;pendingId.current=body.result.id;stored.current=body.result.answers;latest.current=body.result.answers;
      setAnswers(body.result.answers);setAttempt(body.result);setMessage('Your new draft is open. Your previous answers and review are saved.');
      requestAnimationFrame(()=>document.getElementById('answer-'+((question??1)-1))?.focus());
    }catch(error){setError(error instanceof Error?error.message:'Could not start a retry. Please try again.');}
    finally{locked.current=false;setBusy(false);}
  },[attempt,closed,attemptsExhausted]);
  useEffect(()=>{
    if(!retryQuestion||retryStarted.current)return;
    // A retry URL is a one-time navigation intent, not a standing instruction
    // to create another draft after the current draft is submitted.
    retryStarted.current=true;
    const url=new URL(window.location.href);url.searchParams.delete('retry');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
    if(submitted&&!closed)void startRetry(retryQuestion);
  },[retryQuestion,submitted,closed,startRetry]);
  async function save(submit=false) {
    if(submitted||closed)return;
    if(locked.current){if(submit){queuedSubmission.current=true;setBusy(true);}return;}
    if(!submit&&JSON.stringify(latest.current)===JSON.stringify(stored.current)) return;
    locked.current=true;if(submit)setBusy(true);setError('');
    let saved=false;
    const snapshot=[...latest.current];
    pendingId.current??=crypto.randomUUID();
    try {
      const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operation:submit?'submit':'draft',payload:{assignmentId,attemptId:version.current?.id??pendingId.current,revision:version.current?.revision??0,answers:snapshot}}),
        signal:AbortSignal.timeout(25000)});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||'Could not save. Retry without closing this page.');
      version.current=body.result;stored.current=snapshot;setAttempt(body.result);saved=true;
      setMessage(submit?'Your answers have been submitted.':'Draft saved.');
    } catch(e) {setError(e instanceof Error?e.message:'Could not save. Keep this page open and retry.');}
    finally {
      locked.current=false;const shouldSubmit=queuedSubmission.current&&saved&&!submit;queuedSubmission.current=false;
      if(shouldSubmit)void saveLatest.current(true);else setBusy(false);
    }
  }
  const saveLatest=useRef(save);
  useEffect(()=>{saveLatest.current=save;});
  useEffect(()=>{const timer=setInterval(()=>void saveLatest.current(),10000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(JSON.stringify(latest.current)!==JSON.stringify(stored.current)){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  return <><p role="status" aria-live="polite">{message}</p>{error&&<p role="alert">{error}</p>}
    {submitted?<section className="schools-card"><h2>Your answers are saved</h2><p>Attempt {attempt.attempt_number}. {attempt.feedback_status==='ready'?'Your feedback is available.':'Your feedback is awaiting processing. Your submitted answers are safe.'}</p></section>:null}
    {submitted&&<SchoolsFeedback attemptId={attempt.id} rubrics={questions.map(question=>question.rubric)} assignmentId={assignmentId} onRetry={startRetry} retryBusy={busy} status={initial?.id===attempt.id?initial.feedback_status:attempt.feedback_status} detail={initial?.id===attempt.id?initial.evidence_detail:attempt.evidence_detail} covered={initial?.id===attempt.id?initial.evidence_covered:attempt.evidence_covered}/>}
    {submitted&&!closed&&!attemptsExhausted&&<button disabled={busy} onClick={()=>void startRetry(retryQuestion)}>{busy?'Opening your new draft...':retryQuestion?'Retry question '+retryQuestion:'Start a new attempt'}</button>}
    {submitted&&!closed&&attemptsExhausted&&<p>You have used all {maxAttempts} attempts for this assignment. Your answers and feedback stay available here.</p>}
    {questions.map((question,index)=><fieldset key={index}><legend>Question {index+1}: {question.text}</legend>
      <label htmlFor={'answer-'+index}>Your answer</label><textarea id={'answer-'+index} rows={8} maxLength={12000} value={answers[index]} disabled={submitted||closed}
        onChange={e=>{const next=[...answers];next[index]=e.target.value;latest.current=next;setAnswers(next);}} onBlur={()=>void save()}/>
      {!submitted&&<button type="button" onClick={()=>{setPrompts(prompts===index?null:index);if(prompts!==index)void fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'no_example',payload:{cohortId}})}).catch(()=>{});}} aria-expanded={prompts===index}>I cannot think of an example</button>}
      {prompts===index&&<div className="schools-card"><p>Think about one of these experiences:</p><ul>
        <li>Coursework or projects</li><li>Volunteering or community</li><li>Caring or family responsibilities</li><li>Part-time or casual work</li></ul>
        <p>{question.followUp}</p><p>Write what you did in your own words.</p></div>}
    </fieldset>)}
    {!submitted&&<div className="schools-actions"><button disabled={busy||closed} onClick={()=>void save()}>Save draft</button>
      <button disabled={busy||closed||answers.length!==questions.length||answers.some(a=>!a.trim())} onClick={()=>void save(true)}>Submit answers</button></div>}
    {closed&&!submitted&&<p>The due date has passed. Ask your adviser for help.</p>}
    <p>Your adviser can read what you submit. Drafts are private.</p>
    <button onClick={async()=>{try{const r=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'support',payload:{cohortId}})});if(!r.ok)throw new Error();setMessage('Your support request is open.');}catch{setError('Could not request support. Please try again.');}}}>Request adviser support</button>
  </>;
}
