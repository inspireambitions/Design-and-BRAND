'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {EmailSignIn} from '@/components/EmailSignIn';

export function SchoolsStaffInvite({institutionId,role='educator'}:{institutionId:string;role?:'educator'|'institution_admin'}){
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  return <form method="post" className="schools-card" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');
    try{const response=await fetch('/api/schools/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'invite',institutionId,role,contacts:String(form.get('contacts')??'')})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not queue invitations.');setMessage(`${body.queued} invitations queued.${body.failed?` ${body.failed} could not be queued. Please try those addresses again.`:''}`);
    }catch(error){setMessage(error instanceof Error?error.message:'Could not queue invitations.');}finally{setBusy(false);}}}>
    <label>Invite {role==='educator'?'educators':'institution administrators'} by email<textarea name="contacts" required maxLength={8000} placeholder="One email address per line"/></label>
    <p>Use up to 25 institution email addresses. Each person must sign in with the invited address.</p><button disabled={busy}>{busy?'Queuing invitations':'Send invitations'}</button><p role="status">{message}</p>
  </form>;
}
export function SchoolsStaffAccept(){
  const [secret,setSecret]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [accepted,setAccepted]=useState(false);
  useEffect(()=>{const fragment=window.location.hash.slice(1);try{
    if(/^[A-Za-z0-9_-]{43}$/.test(fragment)){setSecret(fragment);sessionStorage.setItem('schools-staff-invitation',JSON.stringify({secret:fragment,at:Date.now()}));}
    else{const saved=JSON.parse(sessionStorage.getItem('schools-staff-invitation')??'null');if(saved&&Date.now()-saved.at<1200000)setSecret(saved.secret);}
  }catch{}if(fragment)window.history.replaceState(null,'',window.location.pathname);},[]);
  if(accepted)return <section className="schools-card"><h1>Invitation accepted</h1><p>Your institution access is available.</p><Link href="/schools/cohorts">View your assigned cohorts</Link><p><Link href="/schools/admin">Institution administration</Link></p></section>;
  return <><h1>Accept your institution invitation</h1><p>First sign in with the email address that received this invitation. Then accept below.</p><EmailSignIn next="/schools/staff"/>
    <form method="post" className="schools-card" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage('');try{
      const response=await fetch('/api/schools/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'accept',secret})});const body=await response.json();if(!response.ok)throw new Error(body.error);
      try{sessionStorage.removeItem('schools-staff-invitation');}catch{}setSecret('');setAccepted(true);
    }catch(error){setMessage(error instanceof Error?error.message:'Could not accept this invitation.');}finally{setBusy(false);}}}>
      {!secret&&<p>Open the private link in your invitation email to continue.</p>}<button disabled={busy||!secret}>{busy?'Accepting invitation':'Accept invitation'}</button><p role="status">{message}</p>
    </form></>;
}
