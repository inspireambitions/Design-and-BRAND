'use client';

import { useLang } from './LanguageProvider';

/**
 * Optional door to a human coach, shown on the results screen.
 *
 * Renders nothing unless NEXT_PUBLIC_COACHING_WHATSAPP is configured, so
 * deployments without a coach are completely unchanged. The button opens the
 * candidate's own WhatsApp addressed to the coach — nothing is sent
 * automatically and nothing about the interview leaves the device here.
 */
const COACHING_NUMBER = (process.env.NEXT_PUBLIC_COACHING_WHATSAPP ?? '').replace(/[^\d]/g, '');

export function CoachingCard() {
  const { lang, t } = useLang();
  if (!COACHING_NUMBER) return null;

  const text =
    lang === 'ar'
      ? 'مرحباً، أتدرب على المقابلات في تطبيق مقابلة وأود أن أسأل عن التدريب الشخصي.'
      : 'Hi, I have been practising interviews on Muqabala and I would like to ask about personal coaching.';

  return (
    <div className="card stack no-print">
      <div>
        <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
          {t('coachingTitle')}
        </p>
        <p className="muted">{t('coachingBody')}</p>
      </div>
      <div className="row">
        <a
          className="btn btn-quiet"
          href={`https://wa.me/${COACHING_NUMBER}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('coachingCta')}
        </a>
      </div>
      <p className="tiny">{t('coachingNote')}</p>
    </div>
  );
}
