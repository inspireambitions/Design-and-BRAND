'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Field={name:string;label:string;type?:'text'|'date'|'email';options?:{value:string;label:string}[]};
export function SchoolsManagementForm({operation,fields,fixed={},button}:{operation:string;fields:Field[];fixed?:Record<string,unknown>;button:string}){
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();
  return <form className="schools-card" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage('');
    const form=new FormData(event.currentTarget);const payload:Record<string,unknown>={...fixed};
    fields.forEach(field=>{payload[field.name]=String(form.get(field.name)??'');});
    try{const response=await fetch('/api/schools/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,payload})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);setMessage('Saved.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save.');}finally{setBusy(false);}}}>
    {fields.map(field=><label key={field.name}>{field.label}{field.options?<select name={field.name} required><option value="">Choose</option>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input name={field.name} type={field.type??'text'} required maxLength={500}/>}</label>)}
    <button disabled={busy}>{button}</button><p role="status">{message}</p></form>;
}
