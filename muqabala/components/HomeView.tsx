'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Role } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

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

  const industries = useMemo(
    () => Array.from(new Set(roles.map((r) => r.industry))).sort(),
    [roles],
  );

  const visible = industry ? roles.filter((r) => r.industry === industry) : roles;

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

      <section className="stack">
        <div>
          <h2>{t('pickRole')}</h2>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            {t('pickRoleBody')}
          </p>
        </div>

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
      </section>

      <footer className="foot">
        <span>{t('privacy')}</span>
        <span>Muqabala · Inspire Ambitions</span>
      </footer>
    </div>
  );
}
