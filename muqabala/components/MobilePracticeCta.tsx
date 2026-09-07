'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Appears only after the main action, never over a focused control or keyboard. */
export function MobilePracticeCta({ label, anchorId }: { label: string; anchorId: string }) {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    observer.observe(anchor);
    const focus = () => setEditing(document.activeElement instanceof HTMLElement && Boolean(document.activeElement.closest('input, textarea, select, [contenteditable="true"], details[open]')));
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
    };
  }, [anchorId]);
  return <Link href="/practice" className="marketing-mobile-cta" hidden={!visible || editing}>{label}</Link>;
}
