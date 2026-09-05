import type { TranscriptSegment } from './interviews';

export type TranscriptionFailure = 'missing_audio' | 'short_transcript' | 'service';
export type ScreeningTranscript = {
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  transcriptTimingVersion: 'openai-whisper-segment-v1' | null;
};

/** Audio is retained by the caller. Never send the video as an audio fallback. */
export async function resolveScreeningTranscript(
  audio: Blob | null,
  fallback: ScreeningTranscript,
  language: 'en' | 'ar',
  required: boolean,
  request: typeof fetch = fetch,
): Promise<{ ok: true; value: ScreeningTranscript } | { ok: false; reason: TranscriptionFailure }> {
  const sufficient = (text: string) => text.trim().split(/\s+/).filter(Boolean).length >= 5;
  if (!audio?.size) {
    return !required || sufficient(fallback.transcript)
      ? { ok: true, value: fallback }
      : { ok: false, reason: 'missing_audio' };
  }
  try {
    const form = new FormData();
    form.append('audio', audio, 'answer');
    form.append('lang', language);
    form.append('timestamps', 'segment');
    const response = await request('/api/transcribe', {
      method: 'POST', body: form, signal: AbortSignal.timeout(35_000),
    });
    const body = await response.json();
    if (!response.ok || typeof body.transcript !== 'string') throw new Error('transcription_service');
    const text = body.transcript.trim();
    if (required && !sufficient(text)) {
      return sufficient(fallback.transcript)
        ? { ok: true, value: fallback }
        : { ok: false, reason: 'short_transcript' };
    }
    return { ok: true, value: text ? {
      transcript: text,
      transcriptSegments: Array.isArray(body.segments) ? body.segments : [],
      transcriptTimingVersion: body.timingVersion === 'openai-whisper-segment-v1' ? body.timingVersion : null,
    } : fallback };
  } catch {
    return !required || sufficient(fallback.transcript)
      ? { ok: true, value: fallback }
      : { ok: false, reason: 'service' };
  }
}
