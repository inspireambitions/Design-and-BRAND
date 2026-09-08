import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedOrigin } from '@/lib/server/security';
import { prepareSchoolsFeedback } from '@/lib/schools/feedback';
import { touchSchoolsSession } from '@/lib/schools/session';
export const maxDuration=60;
export async function POST(request:Request) {
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed'},{status:403});
  const client=await createClient();if(!client)return Response.json({error:'Service unavailable'},{status:503});
  const {data:user}=await client.auth.getUser();if(!user.user)return Response.json({error:'Sign in again'},{status:401});
  if(!await touchSchoolsSession(client))return Response.json({error:'Your session ended. Sign in again.'},{status:401});
  const parsed=z.object({attemptId:z.string().uuid()}).strict().safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});
  const {data:attempt}=await client.from('schools_assignment_attempts').select('id,status,feedback_status').eq('id',parsed.data.attemptId).eq('student_user_id',user.user.id).eq('status','submitted').maybeSingle();
  if(!attempt)return Response.json({error:'Not found'},{status:404});
  const ready=attempt.feedback_status==='ready'||await prepareSchoolsFeedback(attempt.id);
  return Response.json({ready},{status:ready?200:202,headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  const client=await createClient();if(!client)return Response.json({error:'Service unavailable'},{status:503});
  const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in again'},{status:401});
  const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('attemptId'));
  if(!id.success)return Response.json({error:'Invalid request'},{status:400});
  const {data,error}=await client.from('schools_assignment_attempts').select('feedback_status,evidence_detail,evidence_covered').eq('id',id.data).eq('student_user_id',identity.user.id).eq('status','submitted').maybeSingle();
  if(error)return Response.json({error:'Could not check feedback'},{status:503});
  if(!data)return Response.json({error:'Not found'},{status:404});
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
export function HEAD(){return schoolsUnavailable()??new Response(null,{status:405});}
export const OPTIONS=HEAD;export const PUT=HEAD;export const PATCH=HEAD;export const DELETE=HEAD;
