'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Role } from '@/lib/roles';
import { HERO_DRAFT_KEY } from '@/lib/hero-draft';
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
  const router = useRouter();
  const [industry, setIndustry] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroJob, setHeroJob] = useState('');

  const heroJobUsable = heroJob.trim().length >= 120;
  const heroCanStart = heroTitle.trim().length >= 2 || heroJobUsable;

  const startFromHero = () => {
    try {
      sessionStorage.setItem(
        HERO_DRAFT_KEY,
        JSON.stringify({ jobTitle: heroTitle.trim(), jobText: heroJob.trim() }),
      );
    } catch {
      // Blocked storage: navigate anyway; the form on the next page is the
      // same one, so retyping there still works.
    }
    router.push('/practice/custom');
  };

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

        <div className="card stack hero-form" id="job-ad">
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>{t('heroFormTitle')}</h2>
            <p className="muted" style={{ marginTop: '0.3rem', fontSize: '0.92rem' }}>
              {t('heroFormBody')}
            </p>
          </div>
          <label className="stack-sm" htmlFor="hero-job-ad">
            <span className="eyebrow" style={{ marginBottom: 0, color: 'var(--gold)' }}>
              {t('jdLabel')}
            </span>
            <textarea
              id="hero-job-ad"
              className="answer-box answer-box-compact"
              value={heroJob}
              placeholder={t('jdPlaceholder')}
              onChange={(e) => setHeroJob(e.target.value)}
            />
          </label>
          <label className="stack-sm" htmlFor="hero-job-title">
            <span className="eyebrow" style={{ marginBottom: 0 }}>
              {t('customLabel')}
            </span>
            <input
              id="hero-job-title"
              className="text-input"
              type="text"
              value={heroTitle}
              placeholder={t('customPlaceholder')}
              autoComplete="organization-title"
              onChange={(e) => setHeroTitle(e.target.value)}
            />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!heroCanStart}
              onClick={startFromHero}
            >
              {heroJobUsable ? t('jdStartTailored') : t('customStart')}
            </button>
          </div>
          <p className="tiny">{t('heroFormHint')}</p>
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

          <Link href="/practice/custom" className="role-card role-card-custom">
            <div className="role-meta">
              <span className="chip chip-gold">{t('customEyebrow')}</span>
            </div>
            <h3>{t('customCta')}</h3>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              {t('customCtaBody')}
            </p>
          </Link>
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
