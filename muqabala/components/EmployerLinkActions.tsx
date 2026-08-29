'use client';

import { useState } from 'react';
import { Check, Copy, WhatsappLogo } from '@phosphor-icons/react';
import styles from '@/app/employer/EmployerDashboard.module.css';

export function EmployerLinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.linkActions}>
      <button type="button" onClick={() => void copyLink()}>
        {copied ? <Check aria-hidden="true" weight="bold" /> : <Copy aria-hidden="true" />}
        {copied ? 'Link copied' : 'Copy candidate link'}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
        <WhatsappLogo aria-hidden="true" />
        WhatsApp
      </a>
      <span className={styles.srOnly} aria-live="polite">{copied ? 'Candidate link copied.' : ''}</span>
    </div>
  );
}
