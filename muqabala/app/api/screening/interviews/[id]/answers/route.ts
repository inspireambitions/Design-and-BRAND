import { ScreeningAnswerSchema } from '@/lib/interviews';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIDEO_BUCKET = 'screening-videos';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = ScreeningAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid saved response.' }, { status: 400 });
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
  const expectedPrefix = `${interview.screening_pack_id}/${id}/${parsed.data.questionIndex}-`;
  if (!question || !interview.screening_pack_id || !parsed.data.videoPath.startsWith(expectedPrefix)) {
    return Response.json({ error: 'The video does not match this question.' }, { status: 400 });
  }

  const slash = parsed.data.videoPath.lastIndexOf('/');
  const folder = parsed.data.videoPath.slice(0, slash);
  const filename = parsed.data.videoPath.slice(slash + 1);
  const { data: objects, error: objectError } = await access.admin!.storage
    .from(VIDEO_BUCKET)
    .list(folder, { search: filename, limit: 2 });
  const uploaded = objects?.find((object) => object.name === filename);
  if (objectError || !uploaded) {
    return Response.json({ error: 'The video upload has not finished.' }, { status: 409 });
  }
  const storedSize = Number(uploaded.metadata?.size ?? 0);
  if (storedSize > 0 && storedSize !== parsed.data.sizeBytes) {
    return Response.json({ error: 'The uploaded video could not be verified.' }, { status: 409 });
  }

  const questionText = interview.language === 'ar' ? question.textAr : question.text;
  const { data: saved, error } = await access.admin!.rpc('save_screening_video_answer', {
    p_interview_id: id,
    p_anonymous_token_hash: interview.anonymous_token_hash,
    p_question_index: parsed.data.questionIndex,
    p_question_id: question.id,
    p_question_text: questionText,
    p_transcript: parsed.data.transcript,
    p_video_path: parsed.data.videoPath,
    p_video_mime_type: parsed.data.mimeType,
    p_video_size_bytes: parsed.data.sizeBytes,
    p_video_duration_seconds: parsed.data.durationSeconds,
  });
  if (error || saved !== true) return Response.json({ error: 'The response could not be saved.' }, { status: 503 });
  return Response.json({ saved: true }, { headers: privateNoStoreHeaders() });
}
