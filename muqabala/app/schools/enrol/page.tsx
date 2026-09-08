import {requireSchoolsEnabled} from '@/lib/schools/access';
import {SchoolsEnrol} from '@/components/schools/Enrol';
export default function EnrolPage(){requireSchoolsEnabled();return <SchoolsEnrol/>;}
