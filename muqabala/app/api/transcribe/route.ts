import OpenAI, { toFile } from 'openai';
import { limitTranscription } from '@/lib/rate-limit';
import { privateNoStoreHeaders } from '@/lib/server/security';
import {
  MAX_TRANSCRIPTION_BYTES,
  audioFileExtension,
  validateTranscriptionUpload,
} from '@/lib/transcription-upload';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Audio fallback for browsers without live captions.
 *
 * The recording is held in memory for the length of this request, sent to the
 * transcription provider, and dropped. Nothing about the audio or the words is
 * logged or stored here. Video is refused outright: candidate practice video
 * never leaves the device.
 */

const TRANSCRIPTION_TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const FALLBACK_MODEL = 'whisper-1';

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message, retryable } },
    { status, headers: { ...privateNoStoreHeaders(), ...extraHeaders } },
  );
}

function isAbortError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'AbortError' || name === 'APIUserAbortError' || name === 'TimeoutError';
}

/** True when the provider rejected the model itself rather than the request. */
function isModelRejection(error: unknown): boolean {
  if (!(error instanceof OpenAI.APIError)) return false;
  if (error.status === 404) return true;
  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  return code === 'model_not_found' || (error.status === 400 && /model/.test(message));
}

async function transcribeWith(
  client: OpenAI,
  model: string,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  language: 'en' | 'ar',
  signal: AbortSignal,
): Promise<string> {
  const file = await toFile(bytes, filename, { type: contentType });
  const result = await client.audio.transcriptions.create(
    { file, model, language, response_format: 'json' },
    { signal },
  );
  return result.text ?? '';
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(503, 'transcription_unavailable', 'Written transcription is not available right now.', false);
  }

  const contentLength = Number(request.headers.get('content-length'));
  // Multipart framing adds a little; the exact file cap is enforced below.
  if (Number.isFinite(contentLength) && contentLength > MAX_TRANSCRIPTION_BYTES + 64 * 1024) {
    return errorResponse(413, 'audio_too_large', 'That recording is too long to write up.', false);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return errorResponse(415, 'unsupported_media_type', 'Send the recording as multipart form data.', false);
  }

  const rateLimit = await limitTranscription(request);
  if (rateLimit.limited) {
    const retryAfterSeconds = Math.max(30, rateLimit.retryAfterSeconds);
    return errorResponse(
      429,
      'transcription_rate_limited',
      'Too many recordings in a short time. Please wait a few minutes or type your answer.',
      true,
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, 'invalid_form', 'The recording could not be read.', false);
  }

  const audio = form.get('audio');
  const langField = form.get('lang');
  const language = langField === 'ar' ? 'ar' : langField === 'en' ? 'en' : null;
  if (!language) {
    return errorResponse(400, 'lang_required', 'lang must be en or ar.', false);
  }
  if (!(audio instanceof Blob)) {
    return errorResponse(400, 'audio_missing', 'An audio recording is required.', false);
  }

  const check = validateTranscriptionUpload({ type: audio.type, size: audio.size });
  if (!check.ok) {
    return errorResponse(check.status, check.code, check.message, false);
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const filename = `answer.${audioFileExtension(check.mimeType)}`;
  const client = new OpenAI({ timeout: TRANSCRIPTION_TIMEOUT_MS, maxRetries: 0 });
  const configuredModel = process.env.TRANSCRIPTION_MODEL?.trim() || DEFAULT_MODEL;
  const signal = AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS);

  try {
    let transcript: string;
    try {
      transcript = await transcribeWith(client, configuredModel, bytes, filename, check.mimeType, language, signal);
    } catch (error) {
      if (configuredModel !== FALLBACK_MODEL && isModelRejection(error)) {
        transcript = await transcribeWith(client, FALLBACK_MODEL, bytes, filename, check.mimeType, language, signal);
      } else {
        throw error;
      }
    }
    return Response.json({ transcript: transcript.trim() }, { headers: privateNoStoreHeaders() });
  } catch (error) {
    if (isAbortError(error) || error instanceof OpenAI.APIConnectionTimeoutError) {
      return errorResponse(504, 'transcription_timeout', 'Writing up your words took too long.', true);
    }
    // Technical metadata only. Never the audio, the words, or the request body.
    const status = error instanceof OpenAI.APIError ? error.status : 500;
    console.error('transcription_provider_failure', {
      status,
      error: error instanceof Error ? error.name : 'unknown',
    });
    const busy = status === 429 || status === 503;
    return errorResponse(
      503,
      busy ? 'transcription_busy' : 'transcription_failed',
      'Your words could not be written up. Please type your answer.',
      busy,
      busy ? { 'Retry-After': '20' } : {},
    );
  } finally {
    bytes.fill(0);
  }
}
