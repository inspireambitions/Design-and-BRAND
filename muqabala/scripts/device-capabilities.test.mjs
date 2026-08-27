import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeviceCapabilities,
  defaultAnswerMethod,
  videoModeSupported,
} from '../lib/device-capabilities.ts';

test('defaultAnswerMethod prefers typing when speech is unavailable', () => {
  const capabilities = buildDeviceCapabilities({
    isMobile: true,
    speechSupported: false,
    recordingSupported: true,
    mediaDevicesSupported: true,
  });
  assert.equal(defaultAnswerMethod(capabilities), 'type');
});

test('defaultAnswerMethod prefers speak on desktop with speech support', () => {
  const capabilities = buildDeviceCapabilities({
    isMobile: false,
    speechSupported: true,
    recordingSupported: true,
    mediaDevicesSupported: true,
  });
  assert.equal(defaultAnswerMethod(capabilities), 'speak');
});

test('videoModeSupported is true only when mobile recording is available', () => {
  assert.equal(
    videoModeSupported(buildDeviceCapabilities({
      isMobile: true,
      speechSupported: true,
      recordingSupported: true,
      mediaDevicesSupported: true,
    })),
    true,
  );
  assert.equal(
    videoModeSupported(buildDeviceCapabilities({
      isMobile: false,
      speechSupported: true,
      recordingSupported: false,
      mediaDevicesSupported: true,
    })),
    false,
  );
});

test('desktop without media devices gets limited guidance', () => {
  const capabilities = buildDeviceCapabilities({
    isMobile: false,
    speechSupported: true,
    recordingSupported: false,
    mediaDevicesSupported: false,
  });
  assert.equal(capabilities.guidance, 'desktopLimited');
});
