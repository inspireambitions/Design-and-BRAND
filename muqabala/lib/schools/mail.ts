import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createAdminClient} from '../supabase/admin';
import {configuredOrigin} from '../server/security';
import {ResendEmailProvider,type EmailMessage} from '../practice-plan/email-provider';
import {openSchoolsMail} from './mail-crypto';
import {requireSchoolsEnabled} from './access';
const staffMessage=z.object({to:z.string().email(),url:z.string().url()}).strict();
const htmlEscape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export async function processSchoolsMail(){
  requireSchoolsEnabled();const admin=createAdminClient();if(!admin)throw new Error('Storage unavailable');
  const key=process.env.SCHOOLS_RESEND_API_KEY;
  if(!key)throw new Error('Schools email provider is not configured');
  const cleanup=await admin.rpc('schools_cleanup_operations');if(cleanup.error)throw new Error('Expired invitation cleanup failed');
  const provider=new ResendEmailProvider(key);const claim=randomUUID();
  const {data:jobs,error}=await admin.rpc('schools_claim_mail',{claim});if(error)throw new Error('Could not claim emails');
  let sent=0;let failed=0;
  for(const job of jobs??[]) {
    try {
      let to:string;let subject:string;let text:string;
      const type:EmailMessage['messageType']='schools_'+job.kind as EmailMessage['messageType'];
      if(job.kind==='staff') {
        const message=staffMessage.parse(openSchoolsMail(job.encrypted_message));
        if(new URL(message.url).origin!==new URL(configuredOrigin()).origin)throw new Error('Invitation origin changed');
        to=message.to;subject='Your Muqabala institution invitation';
        text='Greetings from Muqabala.\n\nYour institution has invited you to Muqabala for Schools and Colleges. Sign in with this email to accept your invitation:\n\n'+message.url+'\n\nThis private link expires after seven days.';
      } else {
        const identity=await admin.auth.admin.getUserById(job.recipient_user_id);const email=identity.data.user?.email;
        if(identity.error||!email||email.endsWith('.invalid'))throw new Error('Recipient unavailable');to=email;
        if(job.kind==='assignment') {
          subject='Your interview practice assignment';text='Greetings from Muqabala.\n\nYour adviser has assigned three questions. Open your assignment to see its due date and write your answers:\n\n'+configuredOrigin()+'/schools/me/'+job.payload_id+'\n\nYour adviser can read what you submit. Drafts are private.';
        } else {
          subject='Schools data deletion update';text='Greetings from Muqabala.\n\nLocal schools records have been removed for deletion request '+job.payload_id+'. Supplier checks are tracked separately and may still be pending.\n\nYou can contact Muqabala with this reference if you need the final confirmation.';
        }
      }
      const result=await provider.send({to,from:process.env.SCHOOLS_EMAIL_FROM??'Muqabala <hello@auth.trymuqabala.com>',subject,text,html:'<div style="white-space:pre-wrap">'+htmlEscape(text)+'</div>',idempotencyKey:'schools:'+job.id,messageType:type});
      const receipt=await admin.rpc('schools_finish_mail',{message:job.id,claim,provider_id:result.providerMessageId});
      if(receipt.error||!receipt.data)throw new Error('Delivery receipt unavailable');sent++;
    }catch{failed++;await admin.rpc('schools_finish_mail',{message:job.id,claim,provider_id:null});}
  }
  return {sent,failed};
}
