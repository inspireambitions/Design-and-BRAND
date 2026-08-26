'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { POPULAR_ROLE_IDS, type Role } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

const LEVEL_LABELS = {
  en: { Entry: 'Entry', Mid: 'Mid', Senior: 'Senior' },
  ar: { Entry: 'مبتدئ', Mid: 'متوسط', Senior: 'أول' },
} as const;

export function HomeView({ roles }: { roles: Role[] }) {
  const { lang, t } = useLang();
  const [industry, setIndustry] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);

  const industries = useMemo(
    () => Array.from(new Set(roles.map((r) => r.industry))).sort(),
    [roles],
  );

  const popularRoles = useMemo(
    () => POPULAR_ROLE_IDS
      .map((id) => roles.find((role) => role.id === id))
      .filter((role): role is Role => Boolean(role)),
    [roles],
  );
  const visible = browseAll
    ? (industry ? roles.filter((r) => r.industry === industry) : roles)
    : popularRoles;

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

        <div className="start-choice-grid" aria-label={t('chooseStartPath')}>
          <Link href="/practice/custom" className="start-choice-card start-choice-primary">
            <span className="chip chip-gold">{t('bestMatch')}</span>
            <h2>{t('useJobAdvert')}</h2>
            <p>{t('useJobAdvertBody')}</p>
            <span className="start-choice-action">{t('useJobAdvertAction')}</span>
          </Link>
          <Link href="#popular-roles" className="start-choice-card">
            <span className="chip chip-jade">{t('quickStart')}</span>
            <h2>{t('findRole')}</h2>
            <p>{t('findRoleBody')}</p>
            <span className="start-choice-action">{t('findRoleAction')}</span>
          </Link>
        </div>
      </section>

      <section className="stack" id="popular-roles">
        <div>
          <h2>{browseAll ? t('allRoles') : t('popularRoles')}</h2>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            {t('pickRoleBody')}
          </p>
        </div>

        {browseAll && <div className="filters" id="role-directory-filters">
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
        </div>}

        <div className="grid grid-roles">
          {visible.map((role) => {
            return (
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
                  {t('expectOneQuestion')} · {t('expectQuickTime')}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-quiet"
            aria-expanded={browseAll}
            aria-controls="role-directory-filters"
            onClick={() => {
              setBrowseAll((open) => !open);
              setIndustry(null);
            }}
          >
            {browseAll ? t('showPopularRoles') : t('browseAllRoles')}
          </button>
        </div>
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
