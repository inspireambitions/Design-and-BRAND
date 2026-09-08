import {z} from 'zod';
import {schoolsUnavailable} from '@/lib/schools/access';
import {touchSchoolsSession} from '@/lib/schools/session';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {configuredOrigin,hasTrustedOrigin} from '@/lib/server/security';
import {newSchoolsSecret,schoolsSecretHash,schoolsEmailHash} from '@/lib/schools/access-secrets';
import {sealSchoolsMail} from '@/lib/schools/mail-crypto';
import {parseContacts} from '@/lib/employer-volume/contacts';
const schema=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('invite'),institutionId:z.string().uuid(),role:z.enum(['institution_admin','educator']),contacts:z.string().min(1).max(8000)}).strict(),
  z.object({operation:z.literal('accept'),secret:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict(),
]);
export async function POST(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed.'},{status:403});
  const client=await createClient();const admin=createAdminClient();if(!client||!admin)return Response.json({error:'Service unavailable.'},{status:503});
  const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in with your institution email.'},{status:401});
  const body=await request.text();if(body.length>12000)return Response.json({error:'Request too large.'},{status:413});let raw:unknown;try{raw=JSON.parse(body);}catch{return Response.json({error:'Check your request.'},{status:400});}
  const parsed=schema.safeParse(raw);if(!parsed.success)return Response.json({error:'Check the invitation details.'},{status:400});
  if(parsed.data.operation==='accept'){
    if(!identity.user.email||!identity.user.email_confirmed_at)return Response.json({error:'Verify your email first.'},{status:401});
    const result=await admin.rpc('schools_accept_staff',{actor:identity.user.id,verified_email_hash:schoolsEmailHash(identity.user.email),secret_hash:schoolsSecretHash(parsed.data.secret)});
    return result.error?Response.json({error:'This invitation is unavailable for your account.'},{status:403}):Response.json({accepted:true},{headers:{'Cache-Control':'no-store'}});
  }
  const contacts=parseContacts(parsed.data.contacts,'text');
  if(contacts.invalid.length||contacts.valid.some(contact=>!contact.email||contact.email.endsWith('.invalid'))||!contacts.valid.length||contacts.valid.length>25)return Response.json({error:'Enter up to 25 valid institution email addresses.'},{status:400});
  let queued=0;let failed=0;
  for(const contact of contacts.valid){try{const secret=newSchoolsSecret();const message=sealSchoolsMail({to:contact.email,url:configuredOrigin()+'/schools/staff#'+secret});
    const result=await admin.rpc('schools_invite_staff',{actor:identity.user.id,institution:parsed.data.institutionId,staff_role:parsed.data.role,recipient_hash:schoolsEmailHash(contact.email!),secret_hash:schoolsSecretHash(secret),sealed_message:message});
    if(result.error)failed++;else queued++;
  }catch{failed++;}}
  return Response.json({queued,failed},{status:queued?200:503,headers:{'Cache-Control':'no-store'}});
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
