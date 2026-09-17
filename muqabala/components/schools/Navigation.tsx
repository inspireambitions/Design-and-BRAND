'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SchoolsSignOut } from './SignOut';

export function SchoolsNavigation({
  canViewCohorts = false,
  userId,
}: {
  canViewCohorts?: boolean;
  userId?: string;
}) {
  const path = usePathname();

  if (path === '/schools') {
    return (
      <nav aria-label="Institutional Career Readiness" className="schools-nav">
        <Link href="#start-pilot">Enquire about institutional pilot</Link>
        <Link href="/schools/access">Access portal</Link>
      </nav>
    );
  }

  if (['/schools/sign-in', '/schools/enrol', '/schools/staff', '/schools/access'].includes(path)) {
    return (
      <nav aria-label="Institutional Access" className="schools-nav">
        <Link href="/schools">About the institutional platform</Link>
        <Link href="/schools/access" aria-current={path === '/schools/access' ? 'page' : undefined}>
          Access routes
        </Link>
        <Link href="/schools#start-pilot">Request a pilot</Link>
      </nav>
    );
  }

  const isStudent = path.startsWith('/schools/me');

  return (
    <nav aria-label="Workspace Navigation" className="schools-nav">
      {canViewCohorts && (
        <>
          <Link href="/schools/home" aria-current={path === '/schools/home' ? 'page' : undefined}>
            Today
          </Link>
          <Link href="/schools/cohorts" aria-current={path.startsWith('/schools/cohorts') ? 'page' : undefined}>
            Cohorts
          </Link>
        </>
      )}
      <Link href="/schools/me" aria-current={isStudent && path !== '/schools/me/settings' ? 'page' : undefined}>
        {canViewCohorts ? 'Student View' : 'My assignments'}
      </Link>
      <Link href="/schools/me/settings" aria-current={path === '/schools/me/settings' ? 'page' : undefined}>
        Account
      </Link>
      <SchoolsSignOut studentUserId={userId} />
    </nav>
  );
}

