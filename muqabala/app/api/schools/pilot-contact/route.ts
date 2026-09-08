import {z} from 'zod';
import {schoolsUnavailable} from '@/lib/schools/access';
import {createAdminClient} from '@/lib/supabase/admin';
import {hasTrustedOrigin} from '@/lib/server/security';
import {limitAuth} from '@/lib/rate-limit';
const schema=z.object({institution:z.string().trim().min(1).max(160),name:z.string().trim().min(1).max(100),email:z.string().email().max(254),message:z.string().trim().min(1).max(2000)}).strict();
export async function POST(request:Request){
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  if(!hasTrustedOrigin(request))return Response.json({error:'Request not allowed.'},{status:403});
  if((await limitAuth(request,'schools-pilot-contact')).limited)return Response.json({error:'Please wait before trying again.'},{status:429});
  const text=await request.text();if(text.length>6000)return Response.json({error:'Message too long.'},{status:413});
  let body:unknown;try{body=JSON.parse(text);}catch{return Response.json({error:'Check your message.'},{status:400});}
  const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Complete all fields and check your email.'},{status:400});
  const admin=createAdminClient();if(!admin)return Response.json({error:'Please try again later.'},{status:503});
  const {data,error}=await admin.rpc('schools_pilot_contact',{institution_name:parsed.data.institution,person_name:parsed.data.name,contact_email:parsed.data.email,contact_message:parsed.data.message});
  return error?Response.json({error:'Your message could not be saved. Please retry.'},{status:503}):Response.json({reference:data},{headers:{'Cache-Control':'no-store'}});
}
export function GET(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;export const OPTIONS=GET;export const PUT=GET;export const PATCH=GET;export const DELETE=GET;
