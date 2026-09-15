'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function SchoolsSignOut({everywhere=false}:{everywhere?:boolean}) {
  const [error,setError]=useState('');
  const router=useRouter();
  return <div><button onClick={async()=>{
    try {const response=await fetch('/api/schools/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({everywhere})});
      if(!response.ok) throw new Error();
      router.replace('/schools/sign-in');
      router.refresh();
    } catch {setError('Could not sign out. Please try again.');}
  }}>{everywhere?'Sign out everywhere':'Sign out'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
