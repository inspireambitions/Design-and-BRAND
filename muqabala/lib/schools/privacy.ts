import 'server-only';
import {createAdminClient} from '../supabase/admin';
import {requireSchoolsEnabled} from './access';
export async function deleteSchoolsData(jobId:string) {
  requireSchoolsEnabled();const admin=createAdminClient();if(!admin)throw new Error('Storage unavailable');
  const {data:result,error}=await admin.rpc('schools_purge_local',{job_id:jobId});
  if(error||!result)throw new Error('Local deletion failed');
  if(result.deleteAuth&&result.userId) {
    const guard=await admin.rpc('schools_can_delete_auth',{student:result.userId});
    if(guard.error)throw new Error('Account preservation check failed');
    if(guard.data) {
      const deletion=await admin.auth.admin.deleteUser(result.userId);
      if(deletion.error&&deletion.error.status!==404)throw new Error('Account deletion needs retry');
    }
    const marked=await admin.rpc('schools_privacy_auth_done',{job_id:jobId,deleted:!!guard.data});
    if(marked.error)throw new Error('Account deletion receipt needs retry');
  }
  return {localDeleted:true,supplierVerificationPending:true,institutionNotificationPending:true};
}
