'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Lang, StringKey } from '@/lib/i18n';
import { t as translate } from '@/lib/i18n';
import { loadLang, saveLang } from '@/lib/storage';
import { purgeExpiredInterviewDrafts } from '@/lib/session-draft';
import { usePathname } from 'next/navigation';
import { isSchoolsDestination } from '@/lib/auth-destination';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
  dir: 'ltr' | 'rtl';
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translate('en', key),
  dir: 'ltr',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const schools=isSchoolsDestination(usePathname()??'');
  // Schools development copy is English until its confirmed teaching language is implemented.
  const effectiveLang:Lang=schools?'en':lang;

  useEffect(() => {
    purgeExpiredInterviewDrafts(window.localStorage);
    setLangState(loadLang());
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const startAnalytics = () => {
        void import('@/lib/analytics').then(({ initAnalytics }) => initAnalytics());
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(startAnalytics, { timeout: 2000 });
      } else {
        globalThis.setTimeout(startAnalytics, 0);
      }
    }
  }, []);

  useEffect(() => {
    const dir = effectiveLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = effectiveLang;
    document.documentElement.dir = dir;
    document.body.dir = dir;
  }, [effectiveLang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang: effectiveLang,
      dir: effectiveLang === 'ar' ? 'rtl' : 'ltr',
      setLang: (next: Lang) => {
        if(schools)return;
        setLangState(next);
        saveLang(next);
      },
      t: (key: StringKey) => translate(effectiveLang, key),
    }),
    [effectiveLang, schools],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
