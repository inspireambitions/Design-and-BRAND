import Link from 'next/link';
import type { Metadata } from 'next';
import { verifyPreferenceToken } from '@/lib/email/preferences';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const query = await searchParams;
  const done = query.status === 'done';
  const secret = process.env.EMAIL_PREFERENCES_SECRET ?? '';
  const userId = query.token ? verifyPreferenceToken(query.token, secret) : null;
  const admin = createAdminClient();
  const { data: preference } = userId && admin
    ? await admin.from('lifecycle_email_preferences').select('locale,marketing_opt_in').eq('user_id', userId).maybeSingle()
    : { data: null };
  const arabic = preference?.locale === 'ar';

  if (done) {
    return (
      <main className="not-found marketing-wrap">
        <span className="marketing-brand-mark" aria-hidden="true">م</span>
        <p className="marketing-eyebrow">Muqabala</p>
        <h1>{arabic ? 'تم إلغاء الاشتراك' : 'You are unsubscribed'}</h1>
        <p>{arabic ? 'لن نرسل إليك نصائح المنتج أو تحديثات الأدوات بعد الآن. ستستمر رسائل الحساب والأمان الضرورية.' : 'We will no longer send product tips or career-tool updates. Essential account and security emails will continue.'}</p>
        <Link href="/account" className="marketing-button">{arabic ? 'العودة إلى حسابي' : 'Return to my account'}</Link>
      </main>
    );
  }

  if (!userId || !preference) {
    return (
      <main className="not-found marketing-wrap">
        <span className="marketing-brand-mark" aria-hidden="true">م</span>
        <p className="marketing-eyebrow">Muqabala</p>
        <h1>Preference link unavailable<br /><span lang="ar">رابط التفضيلات غير متاح</span></h1>
        <p>This link is invalid. Open your Muqabala account to manage email updates.<br /><span lang="ar" dir="rtl">هذا الرابط غير صالح. افتح حسابك في مقابلة لإدارة تحديثات البريد.</span></p>
        <Link href="/account" className="marketing-button">Go to my account · العودة إلى حسابي</Link>
      </main>
    );
  }

  if (!preference.marketing_opt_in) {
    return (
      <main className="not-found marketing-wrap">
        <span className="marketing-brand-mark" aria-hidden="true">م</span>
        <p className="marketing-eyebrow">Muqabala</p>
        <h1>{arabic ? 'أنت غير مشترك بالفعل' : 'You are already unsubscribed'}</h1>
        <p>{arabic ? 'لن تتلقى نصائح المنتج أو تحديثات الأدوات.' : 'You will not receive product tips or career-tool updates.'}</p>
        <Link href="/account" className="marketing-button">{arabic ? 'العودة إلى حسابي' : 'Return to my account'}</Link>
      </main>
    );
  }

  return (
    <main className="not-found marketing-wrap">
      <span className="marketing-brand-mark" aria-hidden="true">م</span>
      <p className="marketing-eyebrow">Muqabala</p>
      <h1>{arabic ? 'إلغاء تحديثات البريد؟' : 'Stop optional email updates?'}</h1>
      <p>{arabic ? 'سنوقف نصائح المنتج وتحديثات الأدوات. ستستمر رسائل الحساب والأمان الضرورية.' : 'We will stop product tips and career-tool updates. Essential account and security emails will continue.'}</p>
      <form method="post" action={`/api/email/unsubscribe?token=${encodeURIComponent(query.token ?? '')}`}>
        <button type="submit" className="marketing-button">{arabic ? 'إلغاء الاشتراك' : 'Unsubscribe'}</button>
      </form>
    </main>
  );
}
