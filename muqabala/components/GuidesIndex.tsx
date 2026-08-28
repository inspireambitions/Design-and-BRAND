'use client';

import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { MarketingFooter, MarketingHeader } from './MarketingSite';
import { marketingNav } from '@/lib/marketing-content';
import type { GuideListItem } from '@/lib/sanity/queries';

export function GuidesIndex({ guides }: { guides: GuideListItem[] }) {
  const { lang } = useLang();
  const nav = marketingNav[lang];

  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>
        <section className="info-hero marketing-wrap">
          <p className="marketing-eyebrow">{lang === 'ar' ? 'أدلة المقابلات' : 'Interview guides'}</p>
          <h1>{lang === 'ar' ? 'إرشاد عملي لمقابلات العمل في الخليج.' : 'Simple guides for Gulf job interviews.'}</h1>
          <p className="marketing-lede">
            {lang === 'ar'
              ? 'كل دليل يحل مشكلة واحدة. ثم تدرب. لا يرى صاحب العمل تدريبك.'
              : 'Each guide solves one problem. Then practise. No employer can see your practice.'}
          </p>
        </section>
        <section className="marketing-wrap guides-index">
          {guides.length === 0 ? (
            <p>
              {lang === 'ar'
                ? 'سننشر الأدلة هنا. يمكنك التدريب الآن.'
                : 'Guides will appear here. You can start practising now.'}
            </p>
          ) : (
            <ul className="guides-list">
              {guides.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/guides/${guide.slug}`} className="card stack-sm guides-card">
                    <h2>{lang === 'ar' ? guide.titleAr : guide.title}</h2>
                    {(lang === 'ar' ? guide.excerptAr : guide.excerpt) && (
                      <p>{lang === 'ar' ? guide.excerptAr : guide.excerpt}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="guides-index-cta">
            <Link href="/practice" className="marketing-button">{nav.practice}</Link>
          </p>
        </section>
      </main>
      <MarketingFooter />
      <Link href="/practice" className="marketing-mobile-cta">{nav.practice}</Link>
    </div>
  );
}
