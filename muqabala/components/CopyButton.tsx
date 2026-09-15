'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { useLang } from './LanguageProvider';
import styles from './CopyButton.module.css';

type Props = {
  value: string;
  label: string;
  successLabel: string;
  className?: string;
};

export function CopyButton({ value, label, successLabel, className }: Props) {
  const { t } = useLang();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setState('idle');
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, [value]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyValue() {
    if (!value) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
      resetTimer.current = setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
      window.requestAnimationFrame(() => {
        fallbackRef.current?.focus();
        fallbackRef.current?.select();
      });
    }
  }

  function selectFallback() {
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }

  return (
    <span className={styles.wrap}>
      <button type="button" className={className} onClick={() => void copyValue()}>
        <span className={styles.iconSwap} data-copied={state === 'copied'}>
          {state === 'copied' ? <Check aria-hidden="true" weight="bold" /> : <Copy aria-hidden="true" />}
        </span>
        {state === 'copied' ? successLabel : label}
      </button>
      <span className={styles.srOnly} aria-live="polite">{state === 'copied' ? successLabel : state === 'failed' ? t('copyFailed') : ''}</span>
      {state === 'failed' && (
        <span className={styles.fallback} role="alert">
          <span>{t('copyFailed')}</span>
          <textarea ref={fallbackRef} value={value} readOnly rows={value.includes('\n') ? 4 : 1} aria-label={t('copyFailed')} />
          <button type="button" onClick={selectFallback}>{t('copySelect')}</button>
        </span>
      )}
    </span>
  );
}
