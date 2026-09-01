'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { usePathname } from 'next/navigation';
import { deviceClass, track } from '@/lib/analytics';
import { analyticsPagePath } from '@/lib/google-analytics';

const REPORTED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

/** Real-user Core Web Vitals, one event per metric per page, split by device class. */
export function WebVitals() {
  const pathname = usePathname();
  useReportWebVitals((metric) => {
    if (!REPORTED.has(metric.name)) return;
    track('web_vital', {
      metric: metric.name,
      // CLS is unitless and tiny, so it keeps four decimals; the rest are ms.
      value: metric.name === 'CLS' ? Math.round(metric.value * 10_000) / 10_000 : Math.round(metric.value),
      rating: metric.rating,
      path: analyticsPagePath(pathname),
      device_class: deviceClass(),
    });
  });
  return null;
}
