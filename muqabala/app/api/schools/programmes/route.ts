import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { touchSchoolsSession } from '@/lib/schools/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
import { schoolsDevice } from '@/lib/schools/device';

const uuid = z.string().uuid();

export async function GET(request: Request) {
  const unavailable = schoolsUnavailable();
  if (unavailable) return unavailable;
  const client = await createClient();
  if (!client) return Response.json({ error: 'Service unavailable' }, { status: 503 });
  const identity = await touchSchoolsSession(client);
  if (!identity) return Response.json({ error: 'Sign in again' }, { status: 401 });

  const url = new URL(request.url);
  const institutionIdParam = url.searchParams.get('institutionId');

  // Verify membership in institution
  let institutionId = institutionIdParam;
  if (!institutionId) {
    const { data: member } = await client
      .from('schools_institution_members')
      .select('institution_id')
      .eq('user_id', identity.user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle();

    if (!member) return Response.json({ error: 'Not associated with an institution' }, { status: 403 });
    institutionId = member.institution_id;
  }

  const { data: programmes, error } = await client
    .from('schools_programmes')
    .select('id,institution_id,name,code,status,campus,faculty,description,created_at,updated_at')
    .eq('institution_id', institutionId)
    .neq('status', 'archived')
    .order('name');

  if (error) {
    return Response.json({ error: 'Could not load programmes' }, { status: 500 });
  }

  return Response.json({ programmes: programmes || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const unavailable = schoolsUnavailable();
  if (unavailable) return unavailable;
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Request not allowed' }, { status: 403 });

  const client = await createClient();
  if (!client) return Response.json({ error: 'Service unavailable' }, { status: 503 });
  const identity = await touchSchoolsSession(client);
  if (!identity) return Response.json({ error: 'Sign in again' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = z.object({
    institutionId: uuid.optional(),
    programmeId: uuid.optional(),
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().max(32).optional(),
    campus: z.string().trim().max(160).optional(),
    faculty: z.string().trim().max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
  }).safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: 'Invalid programme parameters' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await admin.rpc('schools_manage_action', {
    actor: identity.user.id,
    operation: 'programme',
    payload: parsed.data,
    device: schoolsDevice(request),
  });

  if (error) {
    return Response.json({
      error: error.code === '42501' ? 'Access denied' : 'Could not save programme. Check input fields.',
    }, { status: error.code === '42501' ? 403 : 400 });
  }

  return Response.json({ programme: data }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
