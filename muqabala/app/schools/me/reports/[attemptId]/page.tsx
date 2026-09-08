import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsFeedback } from '@/components/schools/Feedback';
import { SchoolsReadMarker } from '@/components/schools/ReadMarker';
export default async function StudentReport({params}:{params:Promise<{attemptId:string}>}) {
  const {attemptId}=await params;const {client,user}=await schoolsContext();
  const {data:attempt}=await client.from('schools_assignment_attempts').select('id,assignment_id,attempt_number,feedback_status,evidence_detail,evidence_covered,answers').eq('id',attemptId).eq('student_user_id',user.id).eq('status','submitted').maybeSingle();
  if(!attempt)notFound();
  const {data:assignment}=await client.from('schools_assignments').select('cohort_id').eq('id',attempt.assignment_id).maybeSingle();
  if(!assignment)notFound();
  const {data:attempts}=await client.from('schools_assignment_attempts').select('id,attempt_number,evidence_covered').eq('assignment_id',attempt.assignment_id).eq('student_user_id',user.id).eq('status','submitted').order('attempt_number');
  const {data:review}=await client.from('schools_reviews').select('state,comment,revision').eq('assignment_attempt_id',attempt.id).maybeSingle();
  const {data:support}=await client.from('schools_support_requests').select('status,note').eq('cohort_id',assignment.cohort_id).eq('student_user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  const {data:corrections}=await client.from('schools_evidence_corrections').select('question_index,rubric_element,reason,corrected_present').eq('assignment_attempt_id',attempt.id).order('created_at');
  const first=attempts?.find(item=>item.attempt_number===1);
  return <><h1>Your private report</h1><p>Attempt {attempt.attempt_number}. Submitted attempts: {attempts?.length??1}.</p>
    <SchoolsReadMarker attemptId={attempt.id} feedback={attempt.feedback_status==='ready'} reviewRevision={review?.revision??null}/>
    {attempt.attempt_number>1&&first?.evidence_covered!=null&&attempt.evidence_covered!=null&&<p>Evidence covered in attempt 1: {first.evidence_covered} of 12. In this attempt: {attempt.evidence_covered} of 12. Both use the same questions and rubric.</p>}
    <SchoolsFeedback attemptId={attempt.id} status={attempt.feedback_status} detail={attempt.evidence_detail} covered={attempt.evidence_covered} assignmentId={attempt.assignment_id}/>
    {!!corrections?.length&&<section><h2>Adviser evidence corrections</h2><ul>{corrections.map((correction,index)=><li key={index}>Question {correction.question_index+1}, {correction.rubric_element}: {correction.corrected_present?'present':'absent'}. {correction.reason}</li>)}</ul></section>}
    <section id="adviser-comment"><h2>Adviser view of this assignment</h2><p>{review?({on_track:'On track',needs_more:'Needs more',discuss:'Discuss'}[review.state as 'on_track'|'needs_more'|'discuss']):'Not reviewed'}</p>{review?.comment&&<p>{review.comment}</p>}</section>
    <section><h2>Adviser support</h2><p>{support?'Status: '+support.status:'No support request.'}</p>{support?.note&&<p>{support.note}</p>}</section>
    <Link href={'/schools/me/'+attempt.assignment_id}>Return to your assignment</Link></>;
}
