'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Role } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

const COMMON_ROLE_IDS = [
  'front-office-agent',
  'waiter',
  'housekeeping-attendant',
  'driver',
  'retail-sales',
  'security-guard',
] as const;

const LEVEL_LABELS = {
  en: { Entry: 'Entry', Mid: 'Mid', Senior: 'Senior' },
  ar: { Entry: 'مبتدئ', Mid: 'متوسط', Senior: 'أول' },
} as const;

function estimateMinutes(role: Role): number {
  const seconds = role.questions.reduce((s, q) => s + q.prepSeconds + q.answerSeconds, 0);
  return Math.max(5, Math.round(seconds / 60));
}

export function HomeView({ roles }: { roles: Role[] }) {
  const { lang, t } = useLang();
  const [industry, setIndustry] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const industries = useMemo(
    () => Array.from(new Set(roles.map((r) => r.industry))).sort(),
    [roles],
  );

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en');
    return roles.filter((role) => {
      if (industry && role.industry !== industry) return false;
      if (!search) return showAll || COMMON_ROLE_IDS.includes(role.id as (typeof COMMON_ROLE_IDS)[number]);
      const haystack = [
        role.title,
        role.titleAr,
        role.industry,
        role.industryAr,
        role.blurb,
        role.blurbAr,
      ]
        .join(' ')
        .toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en');
      return haystack.includes(search);
    });
  }, [industry, lang, query, roles, showAll]);

  const revealCatalogue = () => {
    setShowAll(true);
    setIndustry(null);
  };

  return (
    <div className="shell">
      <TopBar />

      <section className="hero">
        <p className="eyebrow">{t('tagline')}</p>
        <h1>{t('heroTitle')}</h1>
        <p className="lede">{t('heroBody')}</p>
        <div className="hero-points">
          <span className="chip chip-jade">{t('point1')}</span>
          <span className="chip chip-jade">{t('point2')}</span>
          <span className="chip chip-jade">{t('point3')}</span>
        </div>
      </section>

      <section className="stack entry-section" aria-labelledby="practice-route-title">
        <div>
          <p className="eyebrow">{t('choosePracticeEyebrow')}</p>
          <h2 id="practice-route-title">{t('choosePracticeTitle')}</h2>
        </div>

        <div className="practice-paths">
          <Link href="/practice/custom" className="role-card role-card-custom path-card path-card-featured">
            <div className="role-meta">
              <span className="chip chip-gold">{t('customEyebrow')}</span>
            </div>
            <h3>{t('useJobAdvert')}</h3>
            <p className="muted">{t('useJobAdvertBody')}</p>
            <span className="path-action">{t('pasteJobAdvert')}</span>
          </Link>

          <a href="#common-roles" className="role-card path-card">
            <div className="role-meta">
              <span className="chip chip-jade">{t('commonRolesEyebrow')}</span>
            </div>
            <h3>{t('chooseCommonRole')}</h3>
            <p className="muted">{t('chooseCommonRoleBody')}</p>
            <span className="path-action">{t('browseRoles')}</span>
          </a>
        </div>
        <p className="coaching-trust-line">{t('landingCoaching')}</p>
      </section>

      <section className="stack role-catalogue" id="common-roles">
        <div>
          <h2>{t('pickRole')}</h2>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            {t('pickRoleBody')}
          </p>
        </div>

        <label className="role-search" htmlFor="role-search">
          <span>{t('searchRoles')}</span>
          <input
            id="role-search"
            className="text-input"
            type="search"
            value={query}
            placeholder={t('searchRolesPlaceholder')}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value) setShowAll(true);
            }}
          />
        </label>

        {(showAll || query) && (
          <div className="filters">
            <button
              type="button"
              className="filter-btn"
              aria-pressed={industry === null}
              onClick={() => setIndustry(null)}
            >
              {t('allIndustries')}
            </button>
            {industries.map((ind) => {
              const label =
                lang === 'ar'
                  ? (roles.find((r) => r.industry === ind)?.industryAr ?? ind)
                  : ind;
              return (
                <button
                  key={ind}
                  type="button"
                  className="filter-btn"
                  aria-pressed={industry === ind}
                  onClick={() => setIndustry(ind)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {visible.length === 0 && (
          <div className="notice" role="status">
            <strong>{t('noRoleFound')}</strong>
            <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('noRoleFoundBody')}</p>
            <Link href="/practice/custom" className="btn btn-quiet" style={{ marginTop: '0.75rem' }}>
              {t('pasteJobAdvert')}
            </Link>
          </div>
        )}

        <div className="grid grid-roles">
          {visible.map((role) => (
            <Link key={role.id} href={`/practice/${role.id}`} className="role-card">
              <div className="role-meta">
                <span className="chip chip-jade">
                  {lang === 'ar' ? role.industryAr : role.industry}
                </span>
                <span className="chip">{LEVEL_LABELS[lang][role.level]}</span>
              </div>
              <h3>{lang === 'ar' ? role.titleAr : role.title}</h3>
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                {lang === 'ar' ? role.blurbAr : role.blurb}
              </p>
              <p className="tiny" style={{ marginTop: '0.3rem' }}>
                {role.questions.length} {t('questions')} · ~{estimateMinutes(role)} {t('minutes')}
              </p>
            </Link>
          ))}
        </div>

        {!showAll && !query && (
          <button type="button" className="btn btn-quiet catalogue-toggle" onClick={revealCatalogue}>
            {t('seeAllRoles')} ({roles.length})
          </button>
        )}
      </section>

      <footer className="foot" style={{ flexDirection: 'column', gap: '0.5rem' }}>
        <span>{t('scoringPolicy')}</span>
        <div className="row-between" style={{ width: '100%' }}>
          <span>{t('privacy')}</span>
          <span>Muqabala · Inspire Ambitions</span>
        </div>
      </footer>
    </div>
  );
}
