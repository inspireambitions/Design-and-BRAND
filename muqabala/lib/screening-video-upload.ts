'use client';

export type ScreeningUploadGrant = {
  path: string;
  signedUrl: string;
  maxBytes: number;
};

class ScreeningUploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'ScreeningUploadError';
  }
}

function uploadFailure(request: XMLHttpRequest): ScreeningUploadError {
  if (request.status === 401 || request.status === 403) {
    return new ScreeningUploadError('The secure upload permission expired. Keep this page open and retry saving the response.', false);
  }
  if (request.status === 413) {
    return new ScreeningUploadError('This recording is too large to upload. Please record the answer again.', false);
  }
  if (request.status === 409) {
    return new ScreeningUploadError('The recording is already being saved. Wait a moment, then retry.', true);
  }

  const retryable = request.status === 408
    || request.status === 425
    || request.status === 429
    || request.status >= 500;
  return new ScreeningUploadError('The secure video upload did not finish. Keep this page open and retry.', retryable);
}

function uploadOnce(
  grant: ScreeningUploadGrant,
  file: Blob,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append('cacheControl', '60');
    body.append('', file);

    request.open('PUT', grant.signedUrl);
    request.setRequestHeader('x-upsert', 'true');
    request.upload.onprogress = (event) => {
      onProgress(event.lengthComputable && event.total > 0
        ? Math.min(99, Math.round((event.loaded / event.total) * 100))
        : 0);
    };
    request.onerror = () => reject(new ScreeningUploadError('The secure video upload was interrupted. Check your connection and retry.', true));
    request.onabort = () => reject(new ScreeningUploadError('The secure video upload was interrupted. Please retry.', false));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(uploadFailure(request));
    };
    request.send(body);
  });
}

export async function uploadScreeningVideo(
  grant: ScreeningUploadGrant,
  file: Blob,
  _mimeType: string,
  onProgress: (percentage: number) => void,
): Promise<void> {
  if (file.size <= 0) throw new Error('The recording is empty. Please record the answer again.');
  if (file.size > grant.maxBytes) {
    throw new Error('This recording is too large to upload. Please record the answer again.');
  }

  const retryDelays = [0, 1_000, 3_000];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
    }
    try {
      await uploadOnce(grant, file, onProgress);
      return;
    } catch (caught) {
      const retryable = caught instanceof ScreeningUploadError && caught.retryable;
      if (!retryable || attempt === retryDelays.length - 1) throw caught;
    }
  }
}
