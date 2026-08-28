'use client';

import { useRouter } from 'next/navigation';
import { clearSensitiveLocalData } from '@/lib/storage';
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
  return <button type="button" className={className} onClick={async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    clearSensitiveLocalData();
    router.push('/');
    router.refresh();
  }}>{children ?? t('signOut')}</button>;
}
