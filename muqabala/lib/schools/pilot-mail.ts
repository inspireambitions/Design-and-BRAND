import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {createAdminClient} from '../supabase/admin';
import {EmailProviderError,type EmailProvider} from '../practice-plan/email-provider';

const jobSchema=z.object({
  id:z.string().uuid(),kind:z.enum(['acknowledgement','internal']),recipient:z.string().email(),
  sender:z.literal('Muqabala Schools <hello@auth.trymuqabala.com>'),reply_to:z.literal('hello@trymuqabala.com'),
  subject:z.string().min(1),body_text:z.string().min(1),body_html:z.string().min(1),
});
type MailDatabase=Pick<NonNullable<ReturnType<typeof createAdminClient>>,'rpc'>;

/** Only the cron invokes this worker. Payloads were persisted with the enquiry.
 * A lost provider response or database receipt reuses the job's idempotency key.
 * SQL leases and the 23-hour cutoff bound retries inside Resend's 24-hour window.
 */
export async function processSchoolsPilotMail(admin:MailDatabase,provider:EmailProvider){
  const claim=randomUUID();
  const {data:jobs,error}=await admin.rpc('schools_claim_pilot_mail',{claim});
  if(error)throw new Error('Could not claim pilot mail');
  let accepted=0;let failed=0;
  for(const raw of jobs??[]){
    let providerId:string|null=null;
    let permanentFailure=false;
    try{
      const job=jobSchema.parse(raw);
      if(job.kind==='internal'&&job.recipient!=='hello@trymuqabala.com')throw new Error('Invalid internal recipient');
      const result=await provider.send({
        to:job.recipient,from:job.sender,replyTo:job.reply_to,subject:job.subject,text:job.body_text,html:job.body_html,
        idempotencyKey:'schools-pilot:'+job.id,
        messageType:job.kind==='internal'?'schools_pilot_internal':'schools_pilot_acknowledgement',
      });
      providerId=result.providerMessageId;
    }catch(error){
      // A 409 can mean that another request with this key is still in flight.
      // Never persist raw provider errors, which may contain personal data.
      permanentFailure=error instanceof EmailProviderError
        ? error.kind==='permanent'&&error.safeCode!=='resend_409'
        : error instanceof z.ZodError || (raw.kind==='internal'&&raw.recipient!=='hello@trymuqabala.com');
    }
    try{
      const receipt=await admin.rpc('schools_finish_pilot_mail',{
        message:raw.id,claim,provider_id:providerId,permanent_failure:permanentFailure,
      });
      if(receipt.error||!receipt.data||!providerId)failed++;else accepted++;
    }catch{
      // Leave the lease intact on a lost receipt. The next claim safely replays.
      failed++;
    }
  }
  return {accepted,failed};
}
