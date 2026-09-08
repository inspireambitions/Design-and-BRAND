'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {EmailSignIn} from '@/components/EmailSignIn';
export function SchoolsEnrol() {
  const [secret,setSecret]=useState('');const [recovery,setRecovery]=useState(false);const [adult,setAdult]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [signIn,setSignIn]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{if(!busy){setElapsed(0);return;}const timer=setInterval(()=>setElapsed(value=>value+1),1000);return()=>clearInterval(timer);},[busy]);
  const [complete,setComplete]=useState(false);const [recoveryCode,setRecoveryCode]=useState<string|null>(null);
  useEffect(()=>{
    const fragment=window.location.hash.slice(1);
    if(/^[A-Za-z0-9_-]{43}$/.test(fragment)) {
      setSecret(fragment);window.history.replaceState(null,'',window.location.pathname);
      try{sessionStorage.setItem('schools-pending-enrolment',JSON.stringify({secret:fragment,at:Date.now()}));}catch{}
    }else{try{const saved=JSON.parse(sessionStorage.getItem('schools-pending-enrolment')??'null');if(saved&&Date.now()-saved.at<20*60*1000)setSecret(saved.secret);}catch{}}
  },[]);
  if(complete)return <section className="schools-card"><h1>Your account is available</h1>
    {recoveryCode&&<><h2>Save your recovery code now</h2><p>This code is shown once. Keep it somewhere private. It replaces your previous recovery code.</p>
      <p><code style={{overflowWrap:'anywhere'}}>{recoveryCode}</code></p><p>If you lose it, your adviser can check your identity and issue a recovery link.</p></>}
    <Link href="/schools/me">{recoveryCode?'I have saved the code. Continue':'Continue to your assignments'}</Link></section>;
  return <><h1>Join or recover your student account</h1><p>Use the private link your adviser gave you, or your saved recovery code. A cohort code cannot open an account.</p>
    <form method="post" className="schools-card" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{
      const response=await fetch('/api/schools/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'redeem',secret:secret.trim(),recovery,adultConfirmed:adult}),signal:AbortSignal.timeout(45000)});
      const body=await response.json();if(!response.ok){setSignIn(!!body.signInRequired);throw new Error(body.error);}
      try{sessionStorage.removeItem('schools-pending-enrolment');}catch{}setSecret('');setRecoveryCode(body.recoveryCode);setComplete(true);
    }catch(error){setError(error instanceof Error&&error.name!=='TimeoutError'?error.message:'This took too long. Your code is still here. Please try again.');}finally{setBusy(false);}}}>
      <label htmlFor="schools-access-code">Private link code or recovery code</label><input id="schools-access-code" autoComplete="off" spellCheck={false} required value={secret} onChange={event=>setSecret(event.target.value)} maxLength={100}/>
      <label><input type="checkbox" checked={recovery} onChange={event=>setRecovery(event.target.checked)}/> I am using my saved recovery code</label>
      <label><input type="checkbox" checked={adult} onChange={event=>setAdult(event.target.checked)}/> I confirm I am aged 18 or over</label>
      <p>Your adviser can read what you submit. Drafts are private.</p><button disabled={busy||(!recovery&&!adult)}>{busy?'Opening your account':'Continue'}</button>
      {busy&&<div role="status"><progress aria-label="Opening your account"/><p>{elapsed<10?'Checking your private link and opening your account. Keep this page open.':'Still working. This can take up to 45 seconds. Your code stays here if you need to try again.'}</p></div>}
      {error&&<p role="alert">{error}</p>}
    </form>
    {signIn&&<section className="schools-card"><h2>Sign in with your invited email</h2><EmailSignIn next="/schools/enrol"/></section>}
  </>;
}
