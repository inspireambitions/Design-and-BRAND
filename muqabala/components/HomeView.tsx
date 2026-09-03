'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { popularRoleCards, type RoleCard } from '@/lib/landing/role-cards';
import { AdvertPasteBox } from './landing/AdvertPasteBox';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

/**
 * The /practice landing. Two taps to the first question: paste an advert (or
 * tap one role card, which opens /practice/[roleId] directly), then the mode
 * choice inside the interview. Nothing sits between the card and the role page.
 */
export function HomeView({ roles }: { roles: RoleCard[] }) {
  const { lang, t } = useLang();
  const [industry, setIndustry] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);

  const industries = useMemo(() => {
    const labels = new Map<string, string>();
    for (const role of roles) if (!labels.has(role.industry)) labels.set(role.industry, role.industryAr);
    return Array.from(labels.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [roles]);

  const popular = useMemo(() => popularRoleCards(roles), [roles]);
  const visible = browseAll
    ? (industry ? roles.filter((r) => r.industry === industry) : roles)
    : popular;

  return (
    <div className="shell">
      <TopBar />

      <section className="hero hero-compact">
        <p className="eyebrow">{t('tagline')}</p>
        <h1>{t('heroTitle')}</h1>
        <p className="lede">{t('heroBody')}</p>
        <div className="hero-points">
          <span className="chip chip-jade">{t('point1')}</span>
          <span className="chip chip-jade">{t('point2')}</span>
          <span className="chip chip-jade">{t('point3')}</span>
        </div>
      </section>

      <AdvertPasteBox />

      {process.env.NEXT_PUBLIC_UNIVERSAL_BRAIN_V2 === 'on' && <section className="card row-between brain-entry-card">
        <div>
          <h2>{t('brainTryAdaptive')}</h2>
          <p className="muted">{t('brainTryAdaptiveBody')}</p>
        </div>
        <Link href="/practice/universal" className="btn btn-primary">{t('brainTryAdaptive')}</Link>
      </section>}

      <section className="stack" id="popular-roles" aria-labelledby="popular-roles-heading">
        <div>
          <h2 id="popular-roles-heading">{browseAll ? t('allRoles') : t('landingRolesHeading')}</h2>
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
          {industries.map(([ind, indAr]) => (
            <button
              key={ind}
              type="button"
              className="filter-btn"
              aria-pressed={industry === ind}
              onClick={() => setIndustry(ind)}
            >
              {lang === 'ar' ? indAr : ind}
            </button>
          ))}
        </div>}

        <ul className="grid grid-roles landing-role-list">
          {visible.map((role) => (
            <li key={role.id}>
              <Link href={`/practice/${role.id}`} className="role-card landing-role-card">
                <span className="chip chip-jade">
                  {lang === 'ar' ? role.industryAr : role.industry}
                </span>
                <h3>{lang === 'ar' ? role.titleAr : role.title}</h3>
                <p className="muted landing-role-line">
                  {lang === 'ar' ? role.blurbAr : role.blurb}
                </p>
                <p className="tiny" style={{ margin: 0 }}>
                  {role.questionCount} {t('landingRoleQuestions')} · {t('expectQuickTime')}
                </p>
              </Link>
            </li>
          ))}
        </ul>

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
