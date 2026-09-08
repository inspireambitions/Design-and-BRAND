import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
import { limitAuth } from '@/lib/rate-limit';
import { registerSchoolsSession, touchSchoolsSession } from '@/lib/schools/session';
import { newSchoolsSecret, schoolsEmailHash, schoolsInternalEmail, schoolsSecretHash } from '@/lib/schools/access-secrets';
import {parseContacts} from '@/lib/employer-volume/contacts';

const issue=z.object({operation:z.literal('issue'),cohortId:z.string().uuid(),purpose:z.enum(['enrolment','recovery']),mode:z.enum(['email','pseudonymous']),
  email:z.string().email().optional(),studentId:z.string().uuid().optional(),displayName:z.string().trim().min(1).max(100),identityChecked:z.boolean()}).strict()
  .refine(value=>value.purpose==='recovery'?(value.mode==='pseudonymous'&&!!value.studentId&&value.identityChecked):(value.mode==='email'?!!value.email:!value.email));
const redeem=z.object({operation:z.literal('redeem'),secret:z.string().regex(/^[A-Za-z0-9_-]{43}$/),recovery:z.boolean(),adultConfirmed:z.boolean()}).strict();
const batch=z.object({operation:z.literal('issue_batch'),cohortId:z.string().uuid(),contacts:z.string().min(1).max(8000)}).strict();
export async function POST(request:Request) {
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed.'},{status:403});
  // A fixed bucket prevents callers from evading the limit with fresh codes.
  if((await limitAuth(request,'schools-access')).limited)return Response.json({error:'Please wait before trying again.'},{status:429});
  const body=await request.text();if(body.length>12000)return Response.json({error:'Request too large.'},{status:413});
  let raw:unknown;try{raw=JSON.parse(body);}catch{return Response.json({error:'Check your request.'},{status:400});}
  const parsed=z.union([issue,redeem,batch]).safeParse(raw);
  if(!parsed.success)return Response.json({error:'Check the code and all fields.'},{status:400});
  const admin=createAdminClient();const client=await createClient();
  if(!admin||!client)return Response.json({error:'Service unavailable.'},{status:503});
  let pseudonymousSessionStarted=false;
  try {
    const input=parsed.data;
    if(input.operation==='issue_batch'){
      const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in again.'},{status:401});
      const contacts=parseContacts(input.contacts,'text');
      if(contacts.invalid.length||!contacts.valid.length||contacts.valid.length>25||contacts.valid.some(c=>!c.email||c.email.endsWith('.invalid')))
        return Response.json({error:'Enter up to 25 valid institution email addresses.'},{status:400});
      const links:{email:string;path:string}[]=[];const failed:string[]=[];
      for(const contact of contacts.valid){const secret=newSchoolsSecret();const result=await admin.rpc('schools_issue_access',{
        actor:identity.user.id,cohort:input.cohortId,purpose:'enrolment',mode:'email',secret_hash:schoolsSecretHash(secret),recipient_hash:schoolsEmailHash(contact.email!),student:null,student_name:contact.name?.slice(0,100)||'Student',identity_checked:false});
        if(result.error)failed.push(contact.email!);else links.push({email:contact.email!,path:'/schools/enrol#'+secret});
      }
      return Response.json({links,failed},{status:links.length?200:403,headers:{'Cache-Control':'no-store'}});
    }
    if(input.operation==='issue') {
      const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in again.'},{status:401});
      const secret=newSchoolsSecret();
      const {data:grant,error}=await admin.rpc('schools_issue_access',{actor:identity.user.id,cohort:input.cohortId,purpose:input.purpose,mode:input.mode,
        secret_hash:schoolsSecretHash(secret),recipient_hash:input.mode==='email'?schoolsEmailHash(input.email!):null,
        student:input.studentId??null,student_name:input.displayName,identity_checked:input.identityChecked});
      if(error||!grant)throw new Error('issue');
      if(input.mode==='pseudonymous'&&input.purpose==='enrolment') {
        // No email is sent. The opaque internal address belongs to this grant alone.
        const generated=await admin.auth.admin.generateLink({type:'magiclink',email:schoolsInternalEmail(grant.id)});
        if(generated.error||!generated.data.user)throw new Error('provision');
        const bound=await admin.rpc('schools_bind_pseudonym',{actor:identity.user.id,grant_id:grant.id,student:generated.data.user.id});
        if(bound.error)throw new Error('bind');
      }
      return Response.json({path:'/schools/enrol#'+secret,expiresAt:grant.expiresAt},{headers:{'Cache-Control':'no-store'}});
    }
    const existing=await client.auth.getUser();
    const claim=randomUUID();
    const {data:grant,error}=await admin.rpc('schools_claim_access',{secret_hash:schoolsSecretHash(input.secret),claim,recovery:input.recovery,
      verified_email_hash:existing.data.user?.email&&existing.data.user.email_confirmed_at?schoolsEmailHash(existing.data.user.email):null});
    if(error||!grant)return Response.json({error:'This code is unavailable, expired or already used. Ask your adviser for a new link.'},{status:400});
    if(grant.requiresEmail)return Response.json({error:'Sign in with the email your adviser invited, then continue.',signInRequired:true},{status:401});
    let user=existing.data.user;
    let recoveryCode:string|null=null;
    if(grant.mode==='email') {
      if(!user?.email||!user.email_confirmed_at||schoolsEmailHash(user.email)!==grant.emailHash) {
        return Response.json({error:'Sign in with the email your adviser invited, then try again after two minutes.',signInRequired:true},{status:401});
      }
    } else {
      if(existing.data.user)return Response.json({error:'Sign out before using an email-free account link. Then reopen this link.'},{status:409});
      const account=await admin.auth.admin.getUserById(grant.studentId);
      const email=account.data.user?.email;
      if(account.error||!email||!/^schools-[0-9a-f-]{36}@accounts\.trymuqabala\.invalid$/.test(email))throw new Error('identity');
      const generated=await admin.auth.admin.generateLink({type:'magiclink',email});
      if(generated.error||generated.data.user.id!==grant.studentId)throw new Error('credential');
      const verified=await client.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'email'});
      if(verified.error||verified.data.user?.id!==grant.studentId)throw new Error('verify');
      pseudonymousSessionStarted=true;
      user=verified.data.user;recoveryCode=newSchoolsSecret();
    }
    const complete=await admin.rpc('schools_complete_access',{grant_id:grant.id,claim,student:user!.id,
      verified_email_hash:grant.mode==='email'?schoolsEmailHash(user!.email!):null,
      new_recovery_hash:recoveryCode?schoolsSecretHash(recoveryCode):null,adult_confirmed:input.adultConfirmed});
    if(complete.error) {
      if(grant.mode==='pseudonymous')await client.auth.signOut({scope:'local'});
      throw new Error('complete');
    }
    if(grant.mode==='pseudonymous') {
      if(!await registerSchoolsSession(client))throw new Error('session');
    } else if(!await touchSchoolsSession(client)) {
      return Response.json({next:'/schools/sign-in',recoveryCode:null},{headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({next:'/schools/me',recoveryCode},{headers:{'Cache-Control':'no-store'}});
  } catch {
    if(pseudonymousSessionStarted)await client.auth.signOut({scope:'local'});
    // Grant secrets, Auth tokens and contact details must never reach logs.
    return Response.json({error:'Access could not be completed. Wait two minutes and retry. If the code was used, ask your adviser for a recovery link.'},{status:503});
  }
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
