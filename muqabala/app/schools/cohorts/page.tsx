import Link from 'next/link';
import { schoolsContext } from '@/lib/schools/server';
export default async function CohortsPage() {
  const {client,user}=await schoolsContext();
  const {data:assigned,error}=await client.from('schools_cohort_educators').select('cohort_id').eq('educator_user_id',user.id);
  if(error) throw new Error('Could not load your cohorts');
  const {data:cohorts}=assigned?.length?await client.from('schools_cohorts').select('id,name').in('id',assigned.map(a=>a.cohort_id)):{data:[]};
  return <><h1>Your cohorts</h1>{!cohorts?.length&&<p>No cohorts are assigned to you yet.</p>}
    {cohorts?.map(c=><article className="schools-card" key={c.id}><h2><Link href={'/schools/cohorts/'+c.id}>{c.name}</Link></h2></article>)}</>;
}
