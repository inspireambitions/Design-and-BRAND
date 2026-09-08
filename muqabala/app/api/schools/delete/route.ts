import {schoolsUnavailable} from '@/lib/schools/access';
import {touchSchoolsSession} from '@/lib/schools/session';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {hasTrustedOrigin} from '@/lib/server/security';
import {deleteSchoolsData} from '@/lib/schools/privacy';
export async function POST(request:Request) {
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed.'},{status:403});
  const body=await request.json().catch(()=>null);if(body?.confirm!==true)return Response.json({error:'Confirm your deletion request.'},{status:400});
  const client=await createClient();const admin=createAdminClient();if(!client||!admin)return Response.json({error:'Service unavailable.'},{status:503});
  const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in again.'},{status:401});
  const {data:jobId,error}=await admin.rpc('schools_request_deletion',{actor:identity.user.id});
  if(error||!jobId)return Response.json({error:'Could not register your deletion request.'},{status:503});
  try {await deleteSchoolsData(jobId);await client.auth.signOut({scope:'local'});
    return Response.json({reference:jobId,localDeleted:true,externalChecksPending:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({reference:jobId,localDeleted:false,queued:true},{status:202,headers:{'Cache-Control':'no-store'}});}
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
