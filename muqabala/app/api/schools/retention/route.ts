import {schoolsUnavailable} from '@/lib/schools/access';
import {createAdminClient} from '@/lib/supabase/admin';
import {rejectUnauthorisedCron} from '@/lib/server/cron-auth';
import {deleteSchoolsData} from '@/lib/schools/privacy';
import {reportOperationalFailure} from '@/lib/sentry-server';
export const maxDuration=60;
function workerFailure(code:string,message:string){
  reportOperationalFailure('schools_retention_failed',{area:'cron',job:'schools_retention',code,status:503});
  return Response.json({error:message},{status:503,headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request) {
  const unavailable=schoolsUnavailable();if(unavailable)return unavailable;
  const rejected=rejectUnauthorisedCron(request,'schools_retention');if(rejected)return rejected;
  const admin=createAdminClient();if(!admin)return workerFailure('storage_unavailable','Service unavailable.');
  const housekeeping=await admin.rpc('schools_cleanup_operations');if(housekeeping.error)return workerFailure('cleanup_failed','Could not clean up expired access.');
  const queued=await admin.rpc('schools_queue_retention');if(queued.error)return workerFailure('queue_failed','Could not queue retention.');
  const pending=await admin.rpc('schools_privacy_pending');if(pending.error)return workerFailure('pending_failed','Could not read privacy jobs.');
  let deleted=0;let failed=0;
  const started=Date.now();
  for(const job of (pending.data??[]).slice(0,3)) {if(Date.now()-started>35000)break;try{await deleteSchoolsData(job.id);deleted++;}catch{failed++;}}
  if(failed)reportOperationalFailure('schools_retention_failed',{area:'cron',job:'schools_retention',code:'local_deletion_failed',count:failed,status:503});
  console.info('schools_retention_completed',{queued:queued.data,localDeleted:deleted,failed,scheduled:request.headers.get('user-agent')==='vercel-cron/1.0'});
  return Response.json({queued:queued.data,localDeleted:deleted,failed,externalChecksPending:true},{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
}
export function POST(){return schoolsUnavailable()??Response.json({error:'Not found'},{status:404});}
export const HEAD=POST;export const OPTIONS=POST;export const PUT=POST;export const PATCH=POST;export const DELETE=POST;
