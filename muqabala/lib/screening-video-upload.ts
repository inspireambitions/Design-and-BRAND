'use client';

import * as tus from 'tus-js-client';

export type ScreeningUploadGrant = {
  path: string;
  token: string;
  endpoint: string;
  bucket: string;
  maxBytes: number;
};

export function uploadScreeningVideo(
  grant: ScreeningUploadGrant,
  file: Blob,
  mimeType: string,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: grant.endpoint,
      fingerprint: () => Promise.resolve(
        `muqabala-screening:${grant.path}:${file.size}:${mimeType}`,
      ),
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000],
      headers: { 'x-signature': grant.token },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: grant.bucket,
        objectName: grant.path,
        contentType: mimeType,
        cacheControl: '60',
      },
      onError: reject,
      onProgress: (uploaded, total) => {
        onProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });

    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}
