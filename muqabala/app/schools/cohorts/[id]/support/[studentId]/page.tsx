import Link from 'next/link';
import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {SchoolsSupport} from '@/components/schools/Support';
export default async function StudentSupport({params}:{params:Promise<{id:string;studentId:string}>}){
  const {id,studentId}=await params;const {client,user}=await schoolsContext();
  const {data:assigned}=await client.from('schools_cohort_educators').select('cohort_id').eq('cohort_id',id).eq('educator_user_id',user.id).maybeSingle();if(!assigned)notFound();
  const {data:student}=await client.from('schools_cohort_members').select('display_name').eq('cohort_id',id).eq('student_user_id',studentId).eq('status','active').maybeSingle();if(!student)notFound();
  const {data:support}=await client.from('schools_support_requests').select('status,note,owner_educator_id').eq('cohort_id',id).eq('student_user_id',studentId).neq('status','closed').order('created_at').limit(1).maybeSingle();
  return <><h1>Support for {student.display_name}</h1><p>Support is available before a student submits an answer.</p>
    <SchoolsSupport cohortId={id} studentId={studentId} initial={support} unclaimed={!!support&&!support.owner_educator_id} owned={!support?.owner_educator_id||support.owner_educator_id===user.id}/>
    <Link href={'/schools/cohorts/'+id}>Back to cohort</Link></>;
}
