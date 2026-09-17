import { schoolsContext } from '@/lib/schools/server';
import { SchoolsSignOut } from '@/components/schools/SignOut';
import Link from 'next/link';
export default async function SchoolsSettings(){const {user}=await schoolsContext();return <><h1>Your account</h1><p>Close access on shared devices when you finish.</p><SchoolsSignOut everywhere studentUserId={user.id}/><p><Link href="/schools/me/delete">Delete your schools data</Link></p></>;}
