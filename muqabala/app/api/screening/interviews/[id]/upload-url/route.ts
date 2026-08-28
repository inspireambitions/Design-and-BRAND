import { randomUUID } from 'node:crypto';
import { ScreeningUploadRequestSchema } from '@/lib/interviews';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIDEO_BUCKET = 'screening-videos';

function extension(mimeType: string): string {
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'webm';
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = ScreeningUploadRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid video upload request.' }, { status: 400 });

  const { id } = await params;
  const access = await interviewAccess(id);
  const interview = access.interview;
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!interview || !access.anonymous || interview.mode !== 'screening') {
    return Response.json({ error: 'Interview not found.' }, { status: 404 });
  }
  if (interview.locked_at || interview.status !== 'in_progress') {
    return Response.json({ error: 'This interview has already been submitted.' }, { status: 409 });
  }

  const question = interview.question_snapshot[parsed.data.questionIndex];
  if (!question || parsed.data.questionIndex > interview.current_question || !interview.screening_pack_id) {
    return Response.json({ error: 'This question is not ready.' }, { status: 409 });
  }

  const { data: existing } = await access.admin!.from('interview_answers')
    .select('video_path,video_upload_status')
    .eq('interview_id', id)
    .eq('question_index', parsed.data.questionIndex)
    .maybeSingle();
  if (existing?.video_upload_status === 'uploaded') {
    return Response.json({ error: 'This response is already saved.' }, { status: 409 });
  }

  const path = existing?.video_path || [
    interview.screening_pack_id,
    id,
    `${parsed.data.questionIndex}-${randomUUID()}.${extension(parsed.data.mimeType)}`,
  ].join('/');

  const questionText = interview.language === 'ar' ? question.textAr : question.text;
  const { error: pendingError } = await access.admin!.from('interview_answers').upsert({
    interview_id: id,
    question_index: parsed.data.questionIndex,
    question_id: question.id,
    question_text: questionText,
    transcript: '',
    scoring_status: 'pending',
    video_path: path,
    video_mime_type: parsed.data.mimeType,
    video_upload_status: 'pending',
  }, { onConflict: 'interview_id,question_index' });
  if (pendingError) return Response.json({ error: 'The upload could not be prepared.' }, { status: 503 });

  const { data: signed, error } = await access.admin!.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !signed?.token) return Response.json({ error: 'The upload could not be prepared.' }, { status: 503 });

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return Response.json({ configured: false }, { status: 503 });
  const projectRef = new URL(projectUrl).hostname.split('.')[0];
  return Response.json({
    path,
    token: signed.token,
    endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
    bucket: VIDEO_BUCKET,
    maxBytes: 50 * 1024 * 1024,
  }, { headers: privateNoStoreHeaders() });
}
