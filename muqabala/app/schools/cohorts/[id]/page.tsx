import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsEnrolmentPanel } from '@/components/schools/EnrolmentPanel';
import {createAdminClient} from '@/lib/supabase/admin';
export default async function CohortPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const {client,user}=await schoolsContext();
  const {data:assigned}=await client.from('schools_cohort_educators').select('cohort_id').eq('cohort_id',id).eq('educator_user_id',user.id).maybeSingle();
  if(!assigned)notFound();
  // Only the verified assigned adviser receives the private enrolment controls.
  const admin=createAdminClient();
  const settings=admin?await admin.from('schools_cohorts').select('enrolment_open,enrolment_code').eq('id',id).maybeSingle():{data:null};
  const {data:cohort}=await client.from('schools_cohorts').select('id,name').eq('id',id).maybeSingle();
  const {data:members}=await client.from('schools_cohort_members').select('student_user_id,display_name,status').eq('cohort_id',id).eq('status','active');
  const {data:assignments}=await client.from('schools_assignments').select('id,role_id,due_at').eq('cohort_id',id).order('created_at',{ascending:false});
  const active=assignments?.[0];
  const {data:attempts}=active?await client.from('schools_assignment_attempts').select('id,student_user_id,attempt_number').eq('assignment_id',active.id).eq('status','submitted').order('attempt_number',{ascending:false}):{data:[]};
  const {data:reviews}=attempts?.length?await client.from('schools_reviews').select('assignment_attempt_id,state').in('assignment_attempt_id',attempts.map(attempt=>attempt.id)):{data:[]};
  const {data:support}=await client.from('schools_support_requests').select('student_user_id,status').eq('cohort_id',id).neq('status','closed');
  const labels:Record<string,string>={not_reviewed:'Not reviewed',discuss:'Discuss',needs_more:'Needs more',on_track:'On track',not_submitted:'Not submitted'};
  const order=['not_reviewed','discuss','needs_more','on_track','not_submitted'];
  const rows=(members??[]).map(member=>{
    const submitted=attempts?.filter(attempt=>attempt.student_user_id===member.student_user_id)??[];
    const latest=submitted[0];const state=latest?(reviews?.find(review=>review.assignment_attempt_id===latest.id)?.state??'not_reviewed'):'not_submitted';
    return {...member,submitted:submitted.length,latest,state,support:support?.find(request=>request.student_user_id===member.student_user_id)?.status??'None'};
  }).sort((a,b)=>order.indexOf(a.state)-order.indexOf(b.state)||a.display_name.localeCompare(b.display_name,'en-GB'));
  const notReviewed=rows.filter(row=>row.state==='not_reviewed').length;
  return <><h1>{cohort?.name}</h1>{active&&<p>{active.role_id}. Due {new Date(active.due_at).toLocaleDateString('en-GB',{timeZone:'UTC'})}.</p>}
    <dl className="schools-card"><dt>Enrolled</dt><dd>{rows.length}</dd><dt>Submitted</dt><dd>{rows.filter(row=>row.latest).length}</dd>
      <dt>Not reviewed</dt><dd>{notReviewed}</dd><dt>Support requests open</dt><dd>{support?.length??0}</dd></dl>
    <Link className="schools-button" href={notReviewed?'/schools/cohorts/'+id+'/review?assignment='+active!.id:'/schools/cohorts/'+id+'/assign'}>{notReviewed?'Review '+notReviewed+' not reviewed':'Assign'}</Link>
    <div style={{overflowX:'auto'}}><table><caption>Students in this cohort</caption><thead><tr><th scope="col">Student</th><th scope="col">Submitted attempts</th><th scope="col">Adviser view</th><th scope="col">Support request status</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.student_user_id}><th scope="row">{row.latest?<Link href={'/schools/cohorts/'+id+'/review?attempt='+row.latest.id}>{row.display_name}</Link>:row.display_name}</th><td>{row.submitted}</td><td>{labels[row.state]}</td><td>{row.support}</td></tr>)}</tbody></table></div>
    <h2>Assignments</h2>
    {settings.data&&<SchoolsEnrolmentPanel cohortId={id} students={members??[]} initialOpen={settings.data.enrolment_open} initialCode={settings.data.enrolment_code}/>}
    {assignments?.map(a=><article className="schools-card" key={a.id}><h2>{a.role_id}</h2><p>Due {new Date(a.due_at).toLocaleDateString('en-GB',{timeZone:'UTC'})}</p>
      <Link className="schools-button" href={'/schools/cohorts/'+id+'/review?assignment='+a.id}>Review submitted answers</Link></article>)}</>;
}
