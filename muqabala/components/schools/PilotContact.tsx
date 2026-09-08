'use client';
import {useEffect,useState} from 'react';
export function SchoolsPilotContact(){
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [sent,setSent]=useState(false);
  const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
  return <section id="start-pilot" className="schools-section"><h2>Start a pilot</h2><p>Tell us about your institution, adult students and teaching language.</p>
    {!sent&&<form method="post" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');try{
      const response=await fetch('/api/schools/pilot-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form.entries()))});
      const body=await response.json();if(!response.ok)throw new Error(body.error);setSent(true);setMessage('Your pilot enquiry is saved. We will contact you using the email you provided.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save your enquiry.');}finally{setBusy(false);}}}>
      <label>Institution<input name="institution" autoComplete="organization" maxLength={160} required/></label>
      <label>Your name<input name="name" autoComplete="name" maxLength={100} required/></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
      <label>Message<textarea name="message" rows={5} maxLength={2000} required/></label><button disabled={busy||!ready}>Send pilot enquiry</button>
    </form>}<p role="status">{message}</p></section>;
}
