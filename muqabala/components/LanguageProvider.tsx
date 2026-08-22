'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Lang, StringKey } from '@/lib/i18n';
import { t as translate } from '@/lib/i18n';
import { loadLang, saveLang } from '@/lib/storage';

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

  useEffect(() => {
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
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.dir = dir;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang: (next: Lang) => {
        setLangState(next);
        saveLang(next);
      },
      t: (key: StringKey) => translate(lang, key),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
