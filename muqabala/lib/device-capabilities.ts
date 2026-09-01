'use client';

export type DeviceGuidanceKind = 'mobile' | 'desktopLimited' | 'desktopOk';

export type DeviceCapabilities = {
  isMobile: boolean;
  isDesktop: boolean;
  speechSupported: boolean;
  recordingSupported: boolean;
  mediaDevicesSupported: boolean;
  videoRecommended: boolean;
  guidance: DeviceGuidanceKind;
};

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /MacIntel/i.test(navigator.platform);
}

function speechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );
}

function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export function buildDeviceCapabilities(input: {
  isMobile: boolean;
  speechSupported: boolean;
  recordingSupported: boolean;
  mediaDevicesSupported: boolean;
}): DeviceCapabilities {
  const isDesktop = !input.isMobile;
  const videoRecommended =
    input.isMobile
    && input.mediaDevicesSupported
    && input.recordingSupported
    && input.speechSupported;

  let guidance: DeviceGuidanceKind = 'mobile';
  if (isDesktop && (!input.recordingSupported || !input.mediaDevicesSupported)) {
    guidance = 'desktopLimited';
  } else if (isDesktop) {
    guidance = 'desktopOk';
  }

  return {
    isMobile: input.isMobile,
    isDesktop,
    speechSupported: input.speechSupported,
    recordingSupported: input.recordingSupported,
    mediaDevicesSupported: input.mediaDevicesSupported,
    videoRecommended,
    guidance,
  };
}

/**
 * The first client render must match the server render. Browser capabilities
 * are detected after hydration so React never has to repair different text.
 */
export const INITIAL_DEVICE_CAPABILITIES = buildDeviceCapabilities({
  isMobile: false,
  speechSupported: false,
  recordingSupported: false,
  mediaDevicesSupported: false,
});

export function detectDeviceCapabilities(): DeviceCapabilities {
  const mediaDevicesSupported =
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function';

  return buildDeviceCapabilities({
    isMobile: isMobileDevice(),
    speechSupported: speechSupported(),
    recordingSupported: recordingSupported(),
    mediaDevicesSupported,
  });
}

/** Prefer typing on desktop when video recording is unreliable. */
export function defaultAnswerMethod(capabilities: DeviceCapabilities): 'speak' | 'type' | 'video' {
  if (!capabilities.speechSupported) return 'type';
  if (capabilities.videoRecommended) return 'video';
  if (capabilities.isDesktop) return 'speak';
  return capabilities.speechSupported ? 'speak' : 'type';
}

export function videoModeSupported(capabilities: DeviceCapabilities): boolean {
  return capabilities.videoRecommended;
}

/**
 * Whether a local video rehearsal can be recorded at all, regardless of live
 * captions. Used with the audio-only transcription fallback, where the words
 * are written up after the answer rather than as it is spoken.
 */
export function videoCaptureSupported(capabilities: DeviceCapabilities): boolean {
  return capabilities.isMobile && capabilities.mediaDevicesSupported && capabilities.recordingSupported;
}
