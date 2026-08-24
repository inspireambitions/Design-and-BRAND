'use client';

import { useRouter } from 'next/navigation';
import { clearSensitiveLocalData } from '@/lib/storage';
import { useLang } from './LanguageProvider';

export function SignOutButton() {
  const router = useRouter();
  const { t } = useLang();
  return <button type="button" className="btn btn-ghost" onClick={async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    clearSensitiveLocalData();
    router.push('/');
    router.refresh();
  }}>{t('signOut')}</button>;
}
