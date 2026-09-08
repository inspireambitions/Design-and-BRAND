import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsPractice } from '@/components/schools/Practice';
export default async function AssignmentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{retry?:string}>}) {
  const {id}=await params;
  const query=await searchParams;const retryQuestion=['1','2','3'].includes(query.retry??'')?Number(query.retry):undefined;
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const {client,user}=await schoolsContext();
  const {data:assignment}=await client.from('schools_assignments').select('id,cohort_id,due_at,role_id').eq('id',id).maybeSingle();
  if(!assignment) notFound();
  const {data:membership}=await client.from('schools_cohort_members').select('id').eq('cohort_id',assignment.cohort_id).eq('student_user_id',user.id).eq('status','active').maybeSingle();
  if(!membership) notFound();
  const {data:links,error}=await client.from('schools_assignment_questions').select('question_index,question_version_id').eq('assignment_id',id).order('question_index');
  if(error||links?.length!==3) throw new Error('Assignment questions are not available');
  const {data:versions}=await client.from('schools_question_versions').select('id,question_text,no_example_follow_up,rubric').in('id',links.map(l=>l.question_version_id));
  const questions=links.map(l=>versions?.find(v=>v.id===l.question_version_id));
  if(questions.some(q=>!q)) throw new Error('Assignment questions are not available');
  const {data:attempts}=await client.from('schools_assignment_attempts').select('id,status,answers,revision,attempt_number,feedback_status,evidence_detail,evidence_covered').eq('assignment_id',id).eq('student_user_id',user.id).order('attempt_number',{ascending:false}).limit(1);
  const current=attempts?.[0]??null;
  return <><h1>{assignment.role_id}</h1><p>Three questions. Use examples from your own experience.</p>
    <SchoolsPractice assignmentId={id} cohortId={assignment.cohort_id} questions={questions.map(q=>({text:q!.question_text,followUp:q!.no_example_follow_up,rubric:q!.rubric}))}
      initial={current} dueAt={assignment.due_at} retryQuestion={retryQuestion}/></>;
}
