import {notFound} from 'next/navigation';
import {schoolsContext} from '@/lib/schools/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {SchoolsManagementForm} from '@/components/schools/ManagementForm';
import {SchoolsStaffInvite} from '@/components/schools/StaffInvitation';
export default async function FounderPage({searchParams}:{searchParams:Promise<{institution?:string;from?:string;to?:string}>}){
  const {user}=await schoolsContext();const admin=createAdminClient();if(!admin)notFound();
  const {data:staff}=await admin.from('schools_staff').select('user_id').eq('user_id',user.id).maybeSingle();if(!staff)notFound();
  const {data:institutions}=await admin.from('schools_institutions').select('id,name,language,setup_complete,dpa_complete').order('created_at');
  const {data:events}=await admin.from('schools_audit_log').select('id,action,created_at').order('created_at',{ascending:false}).limit(30);
  const {data:enquiries}=await admin.rpc('schools_pilot_inbox');
  const {data:operations}=await admin.rpc('schools_operations_status',{actor:user.id});
  const query=await searchParams;
  const periodValid=/^\d{4}-\d{2}-\d{2}$/.test(query.from??'')&&/^\d{4}-\d{2}-\d{2}$/.test(query.to??'')&&Date.parse(query.from!)<Date.parse(query.to!);
  const metrics=periodValid&&institutions?.some(i=>i.id===query.institution)?await admin.rpc('schools_pilot_metrics',{actor:user.id,institution:query.institution,period_start:query.from+'T00:00:00Z',period_end:query.to+'T00:00:00Z'}):{data:null};
  const m=metrics.data;
  return <><h1>Institution setup</h1><p>Confirm adult-only participation and the institution's processing arrangement before opening enrolment.</p>
    <SchoolsManagementForm operation="institution" button="Create institution" fields={[{name:'name',label:'Institution name'},{name:'country',label:'Country'},{name:'language',label:'Confirmed teaching language',options:[{value:'en',label:'English'},{value:'ar',label:'Arabic'}]}]}/>
    {institutions?.map(i=><section key={i.id} className="schools-card"><h2>{i.name}</h2><p>{i.setup_complete?'Setup complete':'Setup pending'}</p>
      {!i.setup_complete&&<SchoolsManagementForm operation="approve" fixed={{institutionId:i.id}} button="Record DPA and complete setup" fields={[{name:'dpaReference',label:'Signed DPA reference'}]}/>}
      <SchoolsStaffInvite institutionId={i.id} role="institution_admin"/></section>)}
    <h2>Pilot evidence</h2><form className="schools-card" method="GET"><label>Institution<select name="institution" required defaultValue={query.institution}><option value="">Choose</option>{institutions?.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>Period starts, UTC<input type="date" name="from" required defaultValue={query.from}/></label><label>Period ends, exclusive, UTC<input type="date" name="to" required defaultValue={query.to}/></label><button>View pilot evidence</button></form>
    {m&&<section className="schools-card"><h3>Evidence for the selected period</h3><p>Completion: {m.submitted} submitted students / {m.enrolled} enrolled students.</p><p>Retry: {m.retried} students with two or more submissions / {m.submitted} submitted students.</p><p>Median review time: {m.medianReviewSeconds===null?'Not recorded':Math.round(m.medianReviewSeconds)+' seconds'}.</p><p>Feedback disagreement: {m.correctedElements} distinct corrected elements / {m.reviewedElements} elements in saved reviews.</p><p>Estimated feedback cost per active learner: {m.estimatedCostPerActiveLearnerUsd===null?'Unknown':'US$ '+Number(m.estimatedCostPerActiveLearnerUsd).toFixed(4)}. Denominator: {m.submitted} students with a submission.</p><p>{m.feedbackCalls} recorded feedback calls; {m.unknownCostCalls} have unknown costs. These are token-based estimates for recorded responses. Reconcile failed calls and supplier invoices before reporting actual spend. Retention or deletion can reduce the underlying records.</p></section>}
    <h2>Operations</h2>{operations&&<section className="schools-card"><p>{operations.mailQueued} emails queued or sending. {operations.mailFailed} deliveries need attention.</p>{operations.privacy.map((job:{id:string;reason:string;localDeletedAt:string|null;supplierVerifiedAt:string|null;institutionNotifiedAt:string|null})=><article key={job.id}><h3>Deletion reference {job.id}</h3><p>{job.localDeletedAt?'Local records removed.':'Local deletion pending.'} {job.supplierVerifiedAt?'Supplier check recorded.':'Supplier verification pending.'} {job.institutionNotifiedAt?'Institution notified.':'Institution notification pending.'}</p></article>)}</section>}
    <h2>Pilot enquiries</h2>{(enquiries??[]).map((enquiry:{id:string;institution:string;contact_name:string;email:string;message:string})=><article className="schools-card" key={enquiry.id}><h3>{enquiry.institution}</h3><p>{enquiry.contact_name}: {enquiry.email}</p><p style={{whiteSpace:'pre-wrap'}}>{enquiry.message}</p></article>)}
    <h2>Recent audit events</h2><ul>{events?.map(e=><li key={e.id}>{e.action}: {new Date(e.created_at).toISOString()}</li>)}</ul></>;
}
