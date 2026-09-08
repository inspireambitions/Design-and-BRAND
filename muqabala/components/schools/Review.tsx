'use client';
import { useEffect, useState } from 'react';
export function SchoolsReview({attemptId,initial}:{attemptId:string;initial:{state:string;comment:string;revision:number}|null}) {
  const [state,setState]=useState(initial?.state??'on_track');
  const [comment,setComment]=useState(initial?.comment??'');
  const [revision,setRevision]=useState(initial?.revision??0);
  const [undo,setUndo]=useState(false);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'review_open',payload:{attemptId}})}).catch(()=>{});},[attemptId]);
  useEffect(()=>{if(!undo)return;const timer=setTimeout(()=>setUndo(false),10000);return()=>clearTimeout(timer);},[undo,revision]);
  async function send(operation:'review'|'undo_review') {
    setBusy(true);setMessage('');
    try{const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      operation,payload:operation==='review'?{attemptId,state,comment,revision}:{attemptId,revision}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      setRevision(body.result?.revision??0);setState(body.result?.state??'on_track');setComment(body.result?.comment??'');
      setUndo(operation==='review');setMessage(operation==='review'?'Review saved. Undo is available for 10 seconds.':'Previous review restored.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save. Please retry.');}finally{setBusy(false);}
  }
  return <section className="schools-card"><h2>Adviser view of this assignment</h2>
    <label htmlFor="adviser-view">Your view</label><select id="adviser-view" value={state} onChange={e=>setState(e.target.value)}>
      <option value="on_track">On track</option><option value="needs_more">Needs more</option><option value="discuss">Discuss</option></select>
    <label htmlFor="adviser-comment">Comment, up to 280 characters</label><textarea id="adviser-comment" maxLength={280} value={comment} onChange={e=>setComment(e.target.value)}/>
    <div className="schools-actions"><button disabled={busy} onClick={()=>void send('review')}>Save review</button>
      {undo&&<button disabled={busy} onClick={()=>void send('undo_review')}>Undo</button>}</div><p role="status">{message}</p></section>;
}
