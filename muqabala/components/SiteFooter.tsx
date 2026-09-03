'use client';

import Link from 'next/link';
import { track } from '@/lib/analytics';
import type { StringKey } from '@/lib/i18n';
import { useLang } from './LanguageProvider';
import { MuqabalaMark } from './MarketingSite';

type InternalLink = { id: string; label: StringKey; href: string; external?: false };
type ExternalLink = { id: string; label: StringKey; href: string; external: true };
type FooterLink = InternalLink | ExternalLink;

const groups: Array<{ heading: StringKey; links: FooterLink[] }> = [
  {
    heading: 'footerPrepare',
    links: [
      { id: 'start_interview_practice', label: 'footerStartPractice', href: '/practice' },
      { id: 'interview_readiness', label: 'footerInterviewReadiness', href: 'https://inspireambitions.com/ai-interview-coach/', external: true },
      { id: 'gcc_cv_builder', label: 'footerGccCvBuilder', href: 'https://cv.inspireambitions.com/', external: true },
      { id: 'ai_career_coach', label: 'footerAiCareerCoach', href: 'https://inspireambitions.com/career-change-roadmap', external: true },
    ],
  },
  {
    heading: 'footerUaeCareers',
    links: [
      { id: 'dubai_salary_guides', label: 'footerSalaryGuides', href: 'https://inspireambitions.com/salary-guides/', external: true },
      { id: 'uae_labour_law', label: 'footerLabourLaw', href: 'https://inspireambitions.com/uae-labour-law/', external: true },
      { id: 'uae_gratuity_calculator', label: 'footerGratuityCalculator', href: 'https://inspireambitions.com/uae-gratuity-calculator/', external: true },
      { id: 'moving_to_uae', label: 'footerMovingToUae', href: 'https://inspireambitions.com/moving-to-uae/', external: true },
    ],
  },
  {
    heading: 'footerMuqabala',
    links: [
      { id: 'for_employers', label: 'footerForEmployers', href: '/for-employers' },
      { id: 'about', label: 'footerAbout', href: '/about' },
      { id: 'contact', label: 'footerContact', href: '/contact' },
      { id: 'help_faq', label: 'footerHelpFaq', href: '/faq' },
    ],
  },
  {
    heading: 'footerLegal',
    links: [
      { id: 'privacy', label: 'footerPrivacy', href: '/privacy' },
      { id: 'terms', label: 'footerTerms', href: '/terms' },
      { id: 'accessibility', label: 'footerAccessibility', href: '/accessibility' },
    ],
  },
];

function ExternalIndicator() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M6 3h7v7M13 3 5 11M11 9v4H3V5h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FooterLinkItem({ item }: { item: FooterLink }) {
  const { t } = useLang();
  const onClick = () => track('footer_link_clicked', { link_id: item.id });

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <span>{t(item.label)}</span>
        <ExternalIndicator />
      </a>
    );
  }

  return <Link href={item.href} onClick={onClick}>{t(item.label)}</Link>;
}

function FooterGroup({ group, mobile = false }: { group: (typeof groups)[number]; mobile?: boolean }) {
  const { t } = useLang();
  const list = (
    <ul className="site-footer-links">
      {group.links.map((item) => <li key={item.id}><FooterLinkItem item={item} /></li>)}
    </ul>
  );

  if (mobile) {
    return (
      <details className="site-footer-accordion">
        <summary>{t(group.heading)}</summary>
        {list}
      </details>
    );
  }

  return (
    <section className="site-footer-group" aria-labelledby={`footer-${group.heading}`}>
      <h2 id={`footer-${group.heading}`}>{t(group.heading)}</h2>
      {list}
    </section>
  );
}

export function SiteFooter() {
  const { t } = useLang();
  const trackSupport = (id: string) => track('footer_link_clicked', { link_id: id });

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-intro">
          <div className="site-footer-brand-block">
            <div className="site-footer-brand"><MuqabalaMark inverse /><span>Muqabala</span></div>
            <p>{t('footerPromise')}</p>
            <p className="site-footer-owner">Muqabala by Inspire Ambitions</p>
          </div>
          <div className="site-footer-support">
            <a
              className="site-footer-support-button"
              href="https://inspireambitions.com/book-a-discovery-call/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSupport('book_coaching_call')}
            >
              <span>{t('footerBookCall')}</span><ExternalIndicator />
            </a>
            <a
              className="site-footer-more"
              href="https://inspireambitions.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSupport('more_career_resources')}
            >
              <span>{t('footerMoreResources')}</span><ExternalIndicator />
            </a>
          </div>
        </div>

        <nav className="site-footer-desktop-groups" aria-label={t('footerNavigation')}>
          {groups.map((group) => <FooterGroup key={group.heading} group={group} />)}
        </nav>
        <nav className="site-footer-mobile-groups" aria-label={t('footerNavigation')}>
          {groups.map((group) => <FooterGroup key={group.heading} group={group} mobile />)}
        </nav>
      </div>
    </footer>
  );
}
