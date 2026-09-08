import 'server-only';
import { notFound } from 'next/navigation';
import { schoolsEnabled } from './config';

export function requireSchoolsEnabled(): void {
  if (!schoolsEnabled()) notFound();
}
export function schoolsUnavailable(): Response | null {
  return schoolsEnabled() ? null : Response.json({ error: 'Not found' }, { status: 404 });
}
