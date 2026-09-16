import {z} from 'zod';
import {schoolsUnavailable} from '@/lib/schools/access';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {touchSchoolsSession} from '@/lib/schools/session';
import {hasTrustedOrigin} from '@/lib/server/security';

const schema=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('status'),contactId:z.string().uuid(),status:z.enum(['new','replied','closed'])}).strict(),
  z.object({operation:z.literal('retry_mail'),messageId:z.string().uuid()}).strict(),
]);
export async function POST(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed.'},{status:403});
  const client=await createClient(),admin=createAdminClient();
  if(!client||!admin)return Response.json({error:'Service unavailable.'},{status:503});
  const identity=await touchSchoolsSession(client);
  if(!identity)return Response.json({error:'Sign in again.'},{status:401});
  const text=await request.text();if(text.length>1000)return Response.json({error:'Request too large.'},{status:413});
  let body:unknown;try{body=JSON.parse(text);}catch{return Response.json({error:'Check your request.'},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return Response.json({error:'Check your request.'},{status:400});
  const input=parsed.data;
  const result=input.operation==='status'
    ?await admin.rpc('schools_update_pilot_contact',{actor:identity.user.id,contact:input.contactId,new_status:input.status})
    :await admin.rpc('schools_retry_pilot_mail',{actor:identity.user.id,message:input.messageId});
  if(result.error)return Response.json({error:result.error.code==='42501'?'Founder access is required.':'Could not update this request. Check its current status before retrying.'},{status:result.error.code==='42501'?403:409});
  if(!result.data)return Response.json({error:'Request not found.'},{status:404});
  return Response.json({updated:true},{headers:{'Cache-Control':'no-store'}});
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found.'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
