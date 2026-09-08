import { schoolsUnavailable } from '@/lib/schools/access';
import { verifiedSchoolsIdentity } from '@/lib/schools/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
export async function POST(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed'},{status:403});
  const client=await createClient();const admin=createAdminClient();
  if(!client||!admin)return Response.json({error:'Service unavailable'},{status:503});
  const identity=await verifiedSchoolsIdentity(client);
  if(!identity)return Response.json({error:'Sign in again'},{status:401});
  const all=(await request.json().catch(()=>({}))).everywhere===true;
  let query=admin.from('schools_sessions').update({revoked_at:new Date().toISOString()}).eq('user_id',identity.user.id);
  if(!all)query=query.eq('session_id',identity.sessionId);
  const {error}=await query;
  if(error)return Response.json({error:'Could not sign out. Please retry.'},{status:503});
  const {error:authError}=await client.auth.signOut({scope:all?'global':'local'});
  if(authError)return Response.json({error:'Schools access is closed, but account sign-out needs another try.'},{status:503});
  return Response.json({signedOut:true});
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
