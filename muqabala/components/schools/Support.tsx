'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function SchoolsSupport({cohortId,studentId,initial,owned}:{cohortId:string;studentId:string;initial:{status:string;note:string}|null;owned:boolean}) {
  const router=useRouter();const [status,setStatus]=useState(initial?.status??'open');
  const [note,setNote]=useState(initial?.note??'');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  return <section className="schools-card"><h2>Adviser support</h2><p>{initial?'Request status: '+initial.status:'No open request.'}</p>
    {!owned?<p>Another adviser owns this request.</p>:<>
      {initial&&<><label htmlFor="support-status">Status</label><select id="support-status" value={status} onChange={event=>setStatus(event.target.value)}>
        <option value="open">Open</option><option value="scheduled">Scheduled</option><option value="closed">Closed</option></select></>}
      <label htmlFor="support-note">Support note, visible to the student</label><textarea id="support-note" value={note} maxLength={1000} onChange={event=>setNote(event.target.value)}/>
      <button disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{
        const response=await fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'adviser_support',payload:{cohortId,studentId,status,note}})});
        const body=await response.json();if(!response.ok)throw new Error(body.error);setMessage('Support request saved. You are its owner.');router.refresh();
      }catch(error){setMessage(error instanceof Error?error.message:'Could not save.');}finally{setBusy(false);}}}>{initial?'Save support request':'Request adviser support'}</button>
    </>}<p role="status">{message}</p></section>;
}
