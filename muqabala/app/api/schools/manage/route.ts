import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { touchSchoolsSession } from '@/lib/schools/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
import { questionRubricSchema } from '@/lib/schools/evidence';
import {schoolsDevice} from '@/lib/schools/device';
const uuid=z.string().uuid();
const schema=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('remove_member'),payload:z.object({cohortId:uuid,studentId:uuid}).strict()}),
  z.object({operation:z.literal('archive_cohort'),payload:z.object({cohortId:uuid}).strict()}),
  z.object({operation:z.literal('institution'),payload:z.object({name:z.string().trim().min(1).max(160),country:z.string().trim().min(2).max(80),language:z.enum(['en','ar'])}).strict()}),
  z.object({operation:z.literal('approve'),payload:z.object({institutionId:uuid,dpaReference:z.string().trim().min(1).max(500)}).strict()}),
  z.object({operation:z.literal('staff'),payload:z.object({institutionId:uuid,userId:uuid,role:z.enum(['institution_admin','educator'])}).strict()}),
  z.object({operation:z.literal('cohort'),payload:z.object({institutionId:uuid,name:z.string().trim().min(1).max(160)}).strict()}),
  z.object({operation:z.literal('assign_educator'),payload:z.object({cohortId:uuid,userId:uuid}).strict()}),
  z.object({operation:z.literal('enrolment'),payload:z.object({cohortId:uuid,open:z.boolean(),rotate:z.boolean()}).strict()}),
  z.object({operation:z.literal('question'),payload:z.object({cohortId:uuid,roleId:z.string().min(1).max(100),text:z.string().trim().min(1).max(1200),rubric:questionRubricSchema,followUp:z.string().trim().min(1).max(800)}).strict()}),
  z.object({operation:z.literal('assignment'),payload:z.object({cohortId:uuid,roleId:z.string().min(1).max(100),questionIds:z.array(uuid).length(3).refine(ids=>new Set(ids).size===3),dueAt:z.string().datetime({offset:true})}).strict()}),
]);
export async function POST(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed'},{status:403});
  const client=await createClient();if(!client)return Response.json({error:'Service unavailable'},{status:503});
  const identity=await touchSchoolsSession(client);if(!identity)return Response.json({error:'Sign in again'},{status:401});
  const text=await request.text();if(text.length>18000)return Response.json({error:'Request too large'},{status:413});
  let body:unknown;try{body=JSON.parse(text);}catch{return Response.json({error:'Invalid request'},{status:400});}
  const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Check all fields and try again.'},{status:400});
  const admin=createAdminClient();if(!admin)return Response.json({error:'Service unavailable'},{status:503});
  const {data,error}=await admin.rpc('schools_manage_action',{actor:identity.user.id,operation:parsed.data.operation,payload:parsed.data.payload,device:schoolsDevice(request)});
  if(error)return Response.json({error:error.code==='42501'?'You cannot change this record.':'Could not save. Check the fields and your institution setup.'},{status:error.code==='42501'?403:400});
  return Response.json({result:data},{headers:{'Cache-Control':'no-store'}});
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
