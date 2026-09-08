import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';
import { requireSchoolsEnabled } from './access';
import { touchSchoolsSession } from './session';

export async function schoolsContext() {
  requireSchoolsEnabled();
  const client = await createClient();
  if (!client) throw new Error('Schools storage is not configured');
  const identity = await touchSchoolsSession(client);
  if (!identity) redirect('/schools/sign-in');
  return { client, user: identity.user };
}
