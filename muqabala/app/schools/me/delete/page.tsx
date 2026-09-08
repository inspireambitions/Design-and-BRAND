import {schoolsContext} from '@/lib/schools/server';
import {SchoolsDeleteAccount} from '@/components/schools/DeleteAccount';
export default async function DeletePage(){await schoolsContext();return <SchoolsDeleteAccount/>;}
