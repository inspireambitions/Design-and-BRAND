'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

export function ClaimReportView() {
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get('token');
    if (!token) { setFailed(true); return; }
    // Remove the one-time token from visible browser history as soon as it has
    // been captured. It remains email-bound, short-lived and single-use.
    window.history.replaceState(window.history.state, '', '/reports/claim');
    fetch('/api/reports/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then((response) => { if (!response.ok) throw new Error('claim'); router.replace('/reports'); })
      .catch(() => setFailed(true));
  }, [params, router]);

  return <div className="shell shell-narrow"><TopBar /><main className="card stack"><h1>{failed ? (lang === 'ar' ? 'تعذر حفظ التقرير' : 'This link cannot be used') : (lang === 'ar' ? 'جارٍ حفظ تقريرك…' : 'Saving your report…')}</h1>{failed && <p>{lang === 'ar' ? 'قد يكون الرابط منتهياً أو تم استخدامه من قبل.' : 'It may have expired or already been used.'}</p>}</main></div>;
}
