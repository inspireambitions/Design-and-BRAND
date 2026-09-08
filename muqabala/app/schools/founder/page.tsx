import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {SchoolsManagementForm} from '@/components/schools/ManagementForm';
export default async function FounderPage(){
  const {user}=await schoolsContext();const admin=createAdminClient();if(!admin)notFound();
  const {data:staff}=await admin.from('schools_staff').select('user_id').eq('user_id',user.id).maybeSingle();if(!staff)notFound();
  const {data:institutions}=await admin.from('schools_institutions').select('id,name,language,setup_complete,dpa_complete').order('created_at');
  const {data:events}=await admin.from('schools_audit_log').select('id,action,created_at').order('created_at',{ascending:false}).limit(30);
  return <><h1>Institution setup</h1><p>Confirm adult-only participation and the institution's processing arrangement before opening enrolment.</p>
    <SchoolsManagementForm operation="institution" button="Create institution" fields={[{name:'name',label:'Institution name'},{name:'country',label:'Country'},{name:'language',label:'Confirmed teaching language',options:[{value:'en',label:'English'},{value:'ar',label:'Arabic'}]}]}/>
    {institutions?.map(i=><section key={i.id} className="schools-card"><h2>{i.name}</h2><p>{i.setup_complete?'Setup complete':'Setup pending'}</p>
      {!i.setup_complete&&<SchoolsManagementForm operation="approve" fixed={{institutionId:i.id}} button="Record DPA and complete setup" fields={[{name:'dpaReference',label:'Signed DPA reference'}]}/>}
      <p>Account provisioning remains controlled by Muqabala staff.</p></section>)}
    <h2>Recent audit events</h2><ul>{events?.map(e=><li key={e.id}>{e.action}: {new Date(e.created_at).toISOString()}</li>)}</ul></>;
}
