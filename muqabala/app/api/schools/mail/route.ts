import {schoolsUnavailable} from '@/lib/schools/access';
import {rejectUnauthorisedCron} from '@/lib/server/cron-auth';
import {processSchoolsMail} from '@/lib/schools/mail';
export const maxDuration=60;
export async function GET(request:Request){const unavailable=schoolsUnavailable();if(unavailable)return unavailable;const rejected=rejectUnauthorisedCron(request,'schools_mail');if(rejected)return rejected;
  try{const result=await processSchoolsMail();return Response.json(result,{status:result.failed?503:200,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Schools email delivery needs attention.'},{status:503});}}
export function POST(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=POST;export const OPTIONS=POST;export const PUT=POST;export const PATCH=POST;export const DELETE=POST;
