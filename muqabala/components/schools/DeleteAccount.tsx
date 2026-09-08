'use client';
import {useState} from 'react';
export function SchoolsDeleteAccount(){
  const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [done,setDone]=useState(false);
  return <><h1>Delete your schools data</h1><p>This removes your schools answers, feedback, adviser reviews and support requests. You cannot undo it. Your personal practice and employer records are preserved.</p>
    <p>Your schools access ends when the request is accepted. Supplier checks and institution confirmation are tracked separately.</p>
    {!done&&<form method="post" onSubmit={async event=>{event.preventDefault();setBusy(true);try{const response=await fetch('/api/schools/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:confirmed})});const body=await response.json();if(!response.ok)throw new Error(body.error);
      setDone(true);setMessage((body.localDeleted?'Your schools records have been removed. External checks remain pending.':'Your deletion request is saved and your schools access has ended. Deletion will be retried.')+' Reference: '+body.reference);
    }catch(error){setMessage(error instanceof Error?error.message:'Could not request deletion.');}finally{setBusy(false);}}}>
      <label><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> Delete my schools data</label><button disabled={busy||!confirmed}>Confirm deletion</button></form>}
    <p role="status">{message}</p></>;
}
