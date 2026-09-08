import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { EmployerProofCreate } from '@/components/EmployerProofCreate';
import { catalogueStats } from '@/lib/catalogue-stats';
import { employerVolumeEnabled } from '@/lib/employer-volume';
import { SCREENING_STORAGE_REGION } from '@/lib/marketing-content';
import { currentUser } from '@/lib/supabase/server';
import {pagePreviewMetadata} from '@/lib/link-previews';

export const metadata: Metadata = {
  ...pagePreviewMetadata('employers'),
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

/** Only real product captures are shown. A missing file hides the figure rather than showing a mock. */
function hasPublicAsset(relativePath: string) {
  return existsSync(path.join(process.cwd(), 'public', relativePath));
}

export default async function ForEmployersPage() {
  const user = await currentUser();
  return (
    <EmployerProofCreate
      signedIn={Boolean(user)}
      stats={catalogueStats()}
      hasReportShot={hasPublicAsset('samples/employer-report.png')}
      hasCandidateShot={hasPublicAsset('marketing/candidate-submission.png')}
      storageRegion={SCREENING_STORAGE_REGION}
      volume={employerVolumeEnabled()}
      production={process.env.NODE_ENV === 'production'}
    />
  );
}
