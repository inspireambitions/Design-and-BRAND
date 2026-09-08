import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsReview } from '@/components/schools/Review';
import { SchoolsEvidenceReview } from '@/components/schools/EvidenceReview';
import { SchoolsSupport } from '@/components/schools/Support';
export default async function ReviewPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{assignment?:string;attempt?:string}>}) {
  const {id}=await params;const query=await searchParams;
  const {client,user}=await schoolsContext();
  const {data:assigned}=await client.from('schools_cohort_educators').select('cohort_id').eq('cohort_id',id).eq('educator_user_id',user.id).maybeSingle();
  if(!assigned)notFound();
  const {data:assignments}=await client.from('schools_assignments').select('id').eq('cohort_id',id);
  const ids=assignments?.map(a=>a.id)??[];
  if(query.assignment&&!ids.includes(query.assignment))notFound();
  const {data:attempts}=ids.length?await client.from('schools_assignment_attempts').select('id,student_user_id,attempt_number,answers,submitted_at,assignment_id,evidence_detail').in('assignment_id',query.assignment?[query.assignment]:ids).eq('status','submitted').order('submitted_at'):{data:[]};
  const {data:reviews}=attempts?.length?await client.from('schools_reviews').select('assignment_attempt_id,state,comment,revision,educator_id').in('assignment_attempt_id',attempts.map(a=>a.id)):{data:[]};
  const current=query.attempt?attempts?.find(a=>a.id===query.attempt):attempts?.find(a=>!reviews?.some(r=>r.assignment_attempt_id===a.id));
  if(query.attempt&&!current)notFound();
  if(!current)return <><h1>Submitted work</h1><p>No submitted attempts await review.</p><Link href={'/schools/cohorts/'+id}>Back to cohort</Link></>;
  const {data:member}=await client.from('schools_cohort_members').select('display_name').eq('cohort_id',id).eq('student_user_id',current.student_user_id).maybeSingle();
  const review=reviews?.find(r=>r.assignment_attempt_id===current.id)??null;
  const {data:support}=await client.from('schools_support_requests').select('status,note,owner_educator_id').eq('cohort_id',id).eq('student_user_id',current.student_user_id).neq('status','closed').order('created_at').limit(1).maybeSingle();
  const {data:links}=await client.from('schools_assignment_questions').select('question_index,question_version_id').eq('assignment_id',current.assignment_id).order('question_index');
  const {data:versions}=links?.length?await client.from('schools_question_versions').select('id,question_text,rubric').in('id',links.map(link=>link.question_version_id)):{data:[]};
  const questions=links?.map(link=>versions?.find(version=>version.id===link.question_version_id));
  if(questions?.length!==3||questions.some(question=>!question))throw new Error('Assignment questions are unavailable');
  const {data:corrections}=await client.from('schools_evidence_corrections').select('question_index,rubric_element,corrected_present,reason,created_at').eq('assignment_attempt_id',current.id).order('created_at');
  // A published assignment freezes its question and rubric versions.
  const first=attempts?.find(attempt=>attempt.assignment_id===current.assignment_id&&attempt.student_user_id===current.student_user_id&&attempt.attempt_number===1);
  const newer=attempts?.some(a=>a.student_user_id===current.student_user_id&&a.assignment_id===current.assignment_id&&a.attempt_number>current.attempt_number&&!reviews?.some(r=>r.assignment_attempt_id===a.id));
  return <><h1>{member?.display_name??'Student'}: attempt {current.attempt_number}</h1>
    {newer&&<p role="status">A later attempt is awaiting review.</p>}
    <p>Submitted {new Date(current.submitted_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</p>
    <SchoolsEvidenceReview key={current.id+'-evidence'} attemptId={current.id} answers={current.answers}
      questions={questions.map(question=>({text:question!.question_text,rubric:question!.rubric}))}
      detail={current.evidence_detail} corrections={corrections??[]} firstAnswers={current.attempt_number>1&&first?first.answers:null}/>
    {review&&review.educator_id!==user.id?<p>This review belongs to another adviser.</p>:<SchoolsReview key={current.id} attemptId={current.id} initial={review}/>}
    <SchoolsSupport key={current.id+'-support'} cohortId={id} studentId={current.student_user_id} initial={support} unclaimed={!!support&&!support.owner_educator_id} owned={!support?.owner_educator_id||support.owner_educator_id===user.id}/>
    <Link href={'/schools/cohorts/'+id}>Back to cohort</Link></>;
}
