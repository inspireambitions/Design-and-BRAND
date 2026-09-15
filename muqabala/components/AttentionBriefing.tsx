'use client';

import Link from 'next/link';
import type { AttentionItem } from '@/lib/recruiter-suite';
import { employerVolumeProps, track } from '@/lib/analytics';
import styles from './AttentionBriefing.module.css';

export function AttentionBriefing({ items, total, failed = false }: { items: AttentionItem[]; total: number; failed?: boolean }) {
  if (failed) return <section className={styles.section} aria-labelledby="attention-heading"><header><h2 id="attention-heading">Needs your attention</h2></header><div className={styles.error} role="alert"><strong>Attention items could not be loaded.</strong><p>Your roles have not been shown as zero. Retry the dashboard.</p><button type="button" onClick={() => location.reload()}>Retry</button></div></section>;
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="attention-heading">
      <header><div><p>Prioritised from current role records</p><h2 id="attention-heading">Needs your attention</h2></div><span>{total} {total === 1 ? 'item' : 'items'}</span></header>
      <div className={styles.items}>{items.map((item) => <article key={item.id} data-kind={item.kind}><div><strong>{item.title}</strong><p>{item.detail}</p></div><Link href={item.href} onClick={() => track('attention_item_clicked', employerVolumeProps(true, { type: item.kind }))}>{item.action}</Link></article>)}</div>
      {total > items.length && <Link className={styles.all} href="/employer#roles">View all attention items</Link>}
    </section>
  );
}
