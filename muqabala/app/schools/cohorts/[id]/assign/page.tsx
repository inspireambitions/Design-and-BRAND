import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {ROLES} from '@/lib/roles';
import {SchoolsAssign,SchoolsQuestionEditor} from '@/components/schools/Assign';
export default async function AssignPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {client,user}=await schoolsContext();
  const {data:assigned}=await client.from('schools_cohort_educators').select('cohort_id').eq('cohort_id',id).eq('educator_user_id',user.id).maybeSingle();
  if(!assigned)notFound();
  const admin=createAdminClient();if(!admin)notFound();
  const {data:cohort}=await admin.from('schools_cohorts').select('institution_id').eq('id',id).maybeSingle();if(!cohort)notFound();
  const {data:questions,error}=await client.from('schools_question_versions').select('id,role_id,question_text,rubric').eq('institution_id',cohort.institution_id).order('created_at',{ascending:false});
  if(error)throw new Error('Could not load approved questions');
  return <><h1>Assign three questions</h1><p>Review each question and its four rubric elements before assigning.</p>
    <SchoolsAssign cohortId={id} questions={questions??[]}/>
    <SchoolsQuestionEditor cohortId={id} roles={ROLES.map(r=>({id:r.id,title:r.title}))}/></>;
}
