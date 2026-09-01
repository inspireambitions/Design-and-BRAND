'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { analyticsPagePath, GOOGLE_ANALYTICS_ID } from '@/lib/google-analytics';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const [configured, setConfigured] = useState(false);
  const lastPage = useRef('');

  useEffect(() => {
    if (!configured || typeof window.gtag !== 'function') return;
    const pagePath = analyticsPagePath(pathname);
    if (lastPage.current === pagePath) return;
    lastPage.current = pagePath;
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title,
    });
  }, [configured, pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
        strategy="lazyOnload"
      />
      <Script
        id="muqabala-google-analytics"
        strategy="lazyOnload"
        onReady={() => setConfigured(true)}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ANALYTICS_ID}', {
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
