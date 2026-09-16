'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export type PilotEnquiry={
  id:string;institution:string;contact_name:string;email:string;message:string;
  created_at:string;status:'new'|'replied'|'closed';owner_name:string;owner_email:string;
  mail:{id:string;kind:'acknowledgement'|'internal';status:string;attempts:number;canRetry:boolean;failureCode:string|null;providerMessageId?:string|null;deliveryStatus?:string}[];
};
export function PilotInboxItem({enquiry}:{enquiry:PilotEnquiry}){
  const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [status,setStatus]=useState(enquiry.status);
  async function update(body:object){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/schools/pilot-inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not update this enquiry.');
      setMessage('Saved.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not update this enquiry.');}
    finally{setBusy(false);}
  }
  return <article className="schools-card">
    <h3>{enquiry.institution}</h3>
    <p>{enquiry.contact_name}: <a href={'mailto:'+enquiry.email}>{enquiry.email}</a></p>
    <p style={{whiteSpace:'pre-wrap'}}>{enquiry.message}</p>
    <p>Reference: <code>{enquiry.id}</code></p>
    <p>Received: <time dateTime={enquiry.created_at}>{new Date(enquiry.created_at).toISOString().replace('T',' ').slice(0,16)} UTC</time></p>
    <p>Reply owner: {enquiry.owner_name} · {enquiry.owner_email}</p>
    <form onSubmit={event=>{event.preventDefault();void update({operation:'status',contactId:enquiry.id,status});}}>
      <label>Status<select value={status} onChange={event=>setStatus(event.target.value as PilotEnquiry['status'])}>
        <option value="new">Needs a reply</option><option value="replied">Replied</option><option value="closed">Closed</option>
      </select></label>
      <p>Mark “Replied” after you have sent a personal response. Saving this status does not send an email.</p>
      <button disabled={busy}>{busy?'Saving…':'Save enquiry status'}</button>
    </form>
    {enquiry.mail.length===0?<p>No automatic receipt was queued for this earlier enquiry.</p>:<ul>{enquiry.mail.map(mail=><li key={mail.id}>
      {mail.kind==='acknowledgement'?'Requester receipt':'Internal notification'}: {mail.deliveryStatus&&mail.deliveryStatus!=='sent'?mail.deliveryStatus:mail.status==='accepted'?'Accepted by email provider (inbox delivery not confirmed)':mail.status}.
      {['bounced','complained','suppressed','failed'].includes(mail.deliveryStatus??'')&&<p>Delivery needs attention. Check the recipient and provider record before following up.</p>}
      {mail.canRetry&&<button disabled={busy} onClick={()=>void update({operation:'retry_mail',messageId:mail.id})}>Retry {mail.kind==='acknowledgement'?'receipt':'notification'}</button>}
      {mail.status==='failed'&&!mail.canRetry&&<p>Check the provider delivery record before arranging a replacement. Automatic retry is closed.</p>}
    </li>)}</ul>}
    <p role="status">{message}</p>
  </article>;
}
