import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {SchoolsManagementForm} from '@/components/schools/ManagementForm';
import {SchoolsStaffInvite} from '@/components/schools/StaffInvitation';
import {createAdminClient} from '@/lib/supabase/admin';
export default async function InstitutionAdmin(){
  const {client,user}=await schoolsContext();
  const {data:memberships}=await client.from('schools_institution_members').select('institution_id').eq('user_id',user.id).eq('role','institution_admin').not('accepted_at','is',null);
  if(!memberships?.length)notFound();
  const admin=createAdminClient();if(!admin)notFound();
  const ownIds=memberships.map(m=>m.institution_id);
  const {data:cohorts}=await admin.from('schools_cohorts').select('id,name,institution_id').in('institution_id',ownIds);
  const {data:educators}=await client.from('schools_institution_members').select('user_id,institution_id').eq('role','educator').not('accepted_at','is',null).in('institution_id',ownIds);
  const {data:members}=cohorts?.length?await admin.from('schools_cohort_members').select('cohort_id,status').in('cohort_id',cohorts.map(c=>c.id)):{data:[]};
  const {data:institutions}=await client.from('schools_institutions').select('id,name,country,language,setup_complete').in('id',memberships.map(m=>m.institution_id));
  return <><h1>Your institution</h1>{institutions?.map(i=><section className="schools-card" key={i.id}><h2>{i.name}</h2><p>{i.country}. Teaching language: {i.language==='en'?'English':'Arabic'}.</p>
    <p>{i.setup_complete?'Institution setup is complete.':'Muqabala must complete setup before enrolment opens.'}</p>
    <SchoolsStaffInvite institutionId={i.id}/>
    <SchoolsManagementForm operation="cohort" fixed={{institutionId:i.id}} button="Create cohort" fields={[{name:'name',label:'Cohort name'}]}/>
    {cohorts?.filter(c=>c.institution_id===i.id).map(c=><section key={c.id}><h3>{c.name}</h3><p>{members?.filter(m=>m.cohort_id===c.id&&m.status==='active').length??0} active students.</p>
      <SchoolsManagementForm operation="assign_educator" fixed={{cohortId:c.id}} button="Assign educator" fields={[{name:'userId',label:'Accepted educator account',options:(educators??[]).filter(e=>e.institution_id===i.id).map(e=>({value:e.user_id,label:e.user_id}))}]}/></section>)}
    </section>)}</>;
}
