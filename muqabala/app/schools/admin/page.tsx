import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {SchoolsManagementForm} from '@/components/schools/ManagementForm';
export default async function InstitutionAdmin(){
  const {client,user}=await schoolsContext();
  const {data:memberships}=await client.from('schools_institution_members').select('institution_id').eq('user_id',user.id).eq('role','institution_admin').not('accepted_at','is',null);
  if(!memberships?.length)notFound();
  const {data:institutions}=await client.from('schools_institutions').select('id,name,country,language,setup_complete').in('id',memberships.map(m=>m.institution_id));
  return <><h1>Your institution</h1>{institutions?.map(i=><section className="schools-card" key={i.id}><h2>{i.name}</h2><p>{i.country}. Teaching language: {i.language==='en'?'English':'Arabic'}.</p>
    <p>{i.setup_complete?'Institution setup is complete.':'Muqabala must complete setup before enrolment opens.'}</p>
    <SchoolsManagementForm operation="cohort" fixed={{institutionId:i.id}} button="Create cohort" fields={[{name:'name',label:'Cohort name'}]}/></section>)}</>;
}
