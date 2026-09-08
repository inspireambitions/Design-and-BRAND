import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
import { touchSchoolsSession } from '@/lib/schools/session';

const answers = z.array(z.string().max(12000)).length(3);
const attempt = z.object({
  assignmentId: z.string().uuid(), attemptId: z.string().uuid().optional(),
  revision: z.number().int().nonnegative(), answers,
}).strip();
const schema = z.discriminatedUnion('operation', [
  z.object({operation:z.literal('read'),payload:z.object({attemptId:z.string().uuid(),feedback:z.boolean(),reviewRevision:z.number().int().positive().nullable()}).strict()}),
  z.object({operation:z.literal('adviser_support'),payload:z.object({cohortId:z.string().uuid(),studentId:z.string().uuid(),status:z.enum(['open','scheduled','closed']),note:z.string().max(1000)}).strict()}),
  z.object({operation:z.literal('retry'),payload:z.object({attemptId:z.string().uuid()}).strict()}),
  z.object({operation:z.literal('correct'),payload:z.object({attemptId:z.string().uuid(),question:z.number().int().min(0).max(2),
    element:z.string().min(1).max(80),present:z.boolean(),reason:z.string().trim().min(1).max(500)}).strict()}),
  z.object({ operation: z.literal('draft'), payload: attempt }),
  z.object({ operation: z.literal('submit'), payload: attempt }),
  z.object({ operation: z.literal('review'), payload: z.object({
    attemptId:z.string().uuid(),revision:z.number().int().nonnegative(),
    state:z.enum(['on_track','needs_more','discuss']),comment:z.string().max(280),
  }).strict() }),
  z.object({ operation: z.literal('undo_review'), payload: z.object({
    attemptId:z.string().uuid(),revision:z.number().int().nonnegative(),
  }).strict() }),
  z.object({ operation: z.literal('support'), payload: z.object({cohortId:z.string().uuid()}).strict() }),
]);
export async function POST(request: Request) {
  const unavailable = schoolsUnavailable();
  if (unavailable) return unavailable;
  if (!hasTrustedOrigin(request)) return Response.json({ error:'Request not allowed' },{status:403});
  const client = await createClient();
  if (!client) return Response.json({error:'Service unavailable'},{status:503});
  const {data,error:authError}=await client.auth.getUser();
  if (authError || !data.user) return Response.json({error:'Sign in again to continue.'},{status:401});
  if (!await touchSchoolsSession(client)) return Response.json({error:'Your session ended. Sign in again.'},{status:401});
  const text=await request.text();
  if (text.length>50000) return Response.json({error:'Request is too large'},{status:413});
  let raw:unknown;
  try {raw=JSON.parse(text);} catch {return Response.json({error:'Check your request'},{status:400});}
  const parsed=schema.safeParse(raw);
  if (!parsed.success) return Response.json({error:'Check your answers and try again.'},{status:400});
  const admin=createAdminClient();
  if (!admin) return Response.json({error:'Service unavailable'},{status:503});
  const {data:result,error}=parsed.data.operation==='read'?await admin.rpc('schools_mark_read',{
    actor:data.user.id,attempt:parsed.data.payload.attemptId,feedback:parsed.data.payload.feedback,review_revision:parsed.data.payload.reviewRevision,
  }):parsed.data.operation==='adviser_support'?await admin.rpc('schools_adviser_support',{
    actor:data.user.id,cohort:parsed.data.payload.cohortId,student:parsed.data.payload.studentId,
    new_status:parsed.data.payload.status,note_text:parsed.data.payload.note,
  }):parsed.data.operation==='retry'?await admin.rpc('schools_retry',{
    actor:data.user.id,source_attempt:parsed.data.payload.attemptId
  }):parsed.data.operation==='correct'?await admin.rpc('schools_correct_evidence',{
    actor:data.user.id,attempt:parsed.data.payload.attemptId,question:parsed.data.payload.question,
    element:parsed.data.payload.element,present:parsed.data.payload.present,reason_text:parsed.data.payload.reason,
  }):await admin.rpc('schools_write',{
    actor:data.user.id,operation:parsed.data.operation,payload:parsed.data.payload,
  });
  if(error) {
    const status=error.code==='42501'?403:error.code==='40001'?409:error.code==='23514'?400:503;
    const message=status===409?'This answer changed in another window. Reload before saving.':
      status===403?'This assignment is not available to your account.':
      status===400?'Check your answers and try again.':'Your work could not be saved. Keep this page open and retry.';
    return Response.json({error:message},{status});
  }
  return Response.json({result},{headers:{'Cache-Control':'no-store'}});
}
export function GET() {return schoolsUnavailable() ?? Response.json({error:'Not found'},{status:404});}
export const HEAD=GET;
export const OPTIONS=GET;
export const PUT=GET;
export const PATCH=GET;
export const DELETE=GET;
