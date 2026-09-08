import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { schoolsEnabled } from './config';
type Client=NonNullable<Awaited<ReturnType<typeof createClient>>>;
export async function verifiedSchoolsIdentity(client:Client) {
  const {data:user,error}=await client.auth.getUser();
  if(error||!user.user)return null;
  const {data:claims,error:claimError}=await client.auth.getClaims();
  const sessionId=claims?.claims?.session_id;
  if(claimError||typeof sessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(sessionId))return null;
  return {user:user.user,sessionId};
}
/** Called only immediately after a successful OTP verification. */
export async function registerSchoolsSession(client:Client):Promise<boolean> {
  if(!schoolsEnabled())return false;
  const identity=await verifiedSchoolsIdentity(client);const admin=createAdminClient();
  if(!identity||!admin)return false;
  const {error}=await admin.from('schools_sessions').insert({session_id:identity.sessionId,user_id:identity.user.id});
  return !error;
}
export async function touchSchoolsSession(client:Client) {
  if(!schoolsEnabled())return null;
  const identity=await verifiedSchoolsIdentity(client);const admin=createAdminClient();
  if(!identity||!admin)return null;
  const now=new Date();const cutoff=new Date(now.getTime()-12*60*60*1000).toISOString();
  const {data,error}=await admin.from('schools_sessions').update({last_seen_at:now.toISOString()})
    .eq('session_id',identity.sessionId).eq('user_id',identity.user.id).is('revoked_at',null).gt('last_seen_at',cutoff).select('session_id').maybeSingle();
  return error||!data?null:identity;
}
