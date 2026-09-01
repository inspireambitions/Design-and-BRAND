'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackTiming, type TimingEventName } from '@/lib/analytics';
import { analyticsPagePath } from '@/lib/google-analytics';

/**
 * Time from navigation start to the page being interactive, sent once per
 * page view. Mount it on a server-rendered page whose load time is a target.
 */
export function LoadTiming({ event }: { event: TimingEventName }) {
  const pathname = usePathname();
  useEffect(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const loaded = navigation?.domContentLoadedEventEnd || performance.now();
    trackTiming(event, loaded, { path: analyticsPagePath(pathname) });
  }, [event, pathname]);
  return null;
}
