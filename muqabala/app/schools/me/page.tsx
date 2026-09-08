import Link from 'next/link';
import { schoolsContext } from '@/lib/schools/server';
import { schoolsHomeAction } from '@/lib/schools/home-action';
export default async function SchoolsHome() {
  const {client,user}=await schoolsContext();
  const {data:assignments,error}=await client.from('schools_assignments').select('id,role_id,due_at').order('due_at');
  if(error) throw new Error('Could not load assignments');
  const {data:attempts}=await client.from('schools_assignment_attempts').select('id,assignment_id,status,attempt_number,feedback_status,feedback_opened_at,comment_read_revision,evidence_detail').eq('student_user_id',user.id).order('attempt_number',{ascending:false});
  const {data:reviews}=attempts?.length?await client.from('schools_reviews').select('assignment_attempt_id,revision,comment').in('assignment_attempt_id',attempts.map(attempt=>attempt.id)):{data:[]};
  return <><h1>Your assignments</h1><p>Your adviser can read what you submit. Drafts are private.</p>
    {!assignments?.length&&<p>No assignments are available yet. Your institution will enrol you and assign three questions.</p>}
    {assignments?.map(a=>{const attempt=attempts?.find(attempt=>attempt.assignment_id===a.id);const action=schoolsHomeAction(a.id,a.due_at,attempt,reviews?.find(review=>review.assignment_attempt_id===attempt?.id));
      return <article className="schools-card" key={a.id}><h2>{a.role_id}</h2><p>Due {new Date(a.due_at).toLocaleDateString('en-GB',{timeZone:'UTC'})}</p>
      <Link className="schools-button" href={action.href}>{action.label}</Link></article>;})}</>;
}
