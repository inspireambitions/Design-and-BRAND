'use client';
import { useState } from 'react';
export function SchoolsSignOut({everywhere=false}:{everywhere?:boolean}) {
  const [error,setError]=useState('');
  return <div><button onClick={async()=>{
    try {const response=await fetch('/api/schools/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({everywhere})});
      if(!response.ok) throw new Error();
      window.location.assign('/schools/sign-in');
    } catch {setError('Could not sign out. Please try again.');}
  }}>{everywhere?'Sign out everywhere':'Sign out'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
