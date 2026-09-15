'use client';

import { WhatsappLogo } from '@phosphor-icons/react';
import styles from '@/app/employer/EmployerDashboard.module.css';
import { CopyButton } from './CopyButton';
import { useLang } from './LanguageProvider';

export function EmployerLinkActions({ url }: { url: string }) {
  const { t } = useLang();

  return (
    <div className={styles.linkActions}>
      <CopyButton value={url} label={t('proofCopyLink')} successLabel={t('proofCopied')} />
      <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
        <WhatsappLogo aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
