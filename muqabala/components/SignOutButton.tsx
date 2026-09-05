'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearSensitiveLocalData } from '@/lib/storage';
import { clearScreeningRecordingDrafts } from '@/lib/screening-draft-store';
import { signOutWithLocalCleanup } from '@/lib/sign-out';
import { useLang } from './LanguageProvider';

export function SignOutButton({
  className = 'btn btn-ghost',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useLang();
  const [purgeError, setPurgeError] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [pending, setPending] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  return <><button type="button" className={className} disabled={pending} onClick={async () => {
    setPending(true);
    setPurgeError(false);
    setSignOutError(false);
    const result = await signOutWithLocalCleanup({
      clearLocal: async () => {
        clearSensitiveLocalData();
        await clearScreeningRecordingDrafts();
      },
      endSession: async () => signedOut || (await fetch('/api/auth/sign-out', { method: 'POST' })).ok,
    });
    setPurgeError(result.purgeFailed);
    setSignOutError(!result.signedOut);
    setSignedOut(result.signedOut);
    setPending(false);
    // Keep the cleanup warning on screen even when authentication has ended.
    if (result.signedOut && !result.purgeFailed) {
      router.push('/');
      router.refresh();
    }
  }}>{signedOut ? t('retry') : children ?? t('signOut')}</button>
    {signedOut && purgeError && <p role="status">{t('signedOut')}</p>}
    {purgeError && <p role="alert">{t('signOutRecoveryPurgeError')}</p>}
    {signOutError && <p role="alert">{t('signOutFailed')}</p>}
  </>;
}
