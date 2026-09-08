import {schoolsUnavailable} from '@/lib/schools/access';
import {createAdminClient} from '@/lib/supabase/admin';
import {rejectUnauthorisedCron} from '@/lib/server/cron-auth';
import {deleteSchoolsData} from '@/lib/schools/privacy';
export const maxDuration=60;
export async function GET(request:Request) {
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  const rejected=rejectUnauthorisedCron(request,'schools_retention');if(rejected)return rejected;
  const admin=createAdminClient();if(!admin)return Response.json({error:'Service unavailable.'},{status:503});
  const queued=await admin.rpc('schools_queue_retention');if(queued.error)return Response.json({error:'Could not queue retention.'},{status:503});
  const pending=await admin.rpc('schools_privacy_pending');if(pending.error)return Response.json({error:'Could not read privacy jobs.'},{status:503});
  let deleted=0;let failed=0;
  const started=Date.now();
  for(const job of (pending.data??[]).slice(0,3)) {if(Date.now()-started>35000)break;try{await deleteSchoolsData(job.id);deleted++;}catch{failed++;}}
  return Response.json({queued:queued.data,localDeleted:deleted,failed,externalChecksPending:true},{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
}
export function POST(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=POST;export const OPTIONS=POST;export const PUT=POST;export const PATCH=POST;export const DELETE=POST;
