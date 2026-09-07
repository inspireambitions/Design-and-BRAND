'use client';

import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { GuideBody } from './GuideBody';
import { MarketingHeader } from './MarketingSite';
import { marketingNav } from '@/lib/marketing-content';
import type { GuideDocument } from '@/lib/sanity/queries';

function safePracticeHref(href: string): string {
  return href.startsWith('/') && !href.startsWith('//') ? href : '/practice';
}

export function GuidePage({ guide }: { guide: GuideDocument }) {
  const { lang } = useLang();
  const nav = marketingNav[lang];
  const title = lang === 'ar' ? guide.titleAr : guide.title;
  const excerpt = lang === 'ar' ? guide.excerptAr : guide.excerpt;
  const body = lang === 'ar' ? guide.bodyAr : guide.body;

  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>
        <article className="info-hero marketing-wrap guide-article">
          <p className="marketing-eyebrow">
            <Link href="/guides">{lang === 'ar' ? 'الأدلة' : 'Guides'}</Link>
          </p>
          <h1>{title}</h1>
          {excerpt && <p className="marketing-lede">{excerpt}</p>}
          <GuideBody value={Array.isArray(body) ? body : []} />
          <p className="guide-article-cta">
            <Link href={safePracticeHref(guide.practiceHref)} className="marketing-button">
              {nav.practice}
            </Link>
          </p>
        </article>
      </main>
      <Link href="/practice" className="marketing-mobile-cta">{nav.practice}</Link>
    </div>
  );
}
