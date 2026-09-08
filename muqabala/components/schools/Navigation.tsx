'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {SchoolsSignOut} from './SignOut';
export function SchoolsNavigation({canViewCohorts=false}:{canViewCohorts?:boolean}){
  const path=usePathname();
  if(path==='/schools')return <nav aria-label="Schools"><Link href="#start-pilot">Start a pilot</Link></nav>;
  if(['/schools/sign-in','/schools/enrol','/schools/staff'].includes(path))return <nav aria-label="Schools"><Link href="/schools">About the pilot</Link></nav>;
  return <nav aria-label="Schools"><Link href="/schools/me">My assignments</Link>{canViewCohorts&&<Link href="/schools/cohorts">Cohorts</Link>}<Link href="/schools/me/settings">Account</Link><SchoolsSignOut/></nav>;
}
