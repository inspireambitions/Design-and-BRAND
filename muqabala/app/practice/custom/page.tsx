import type { Metadata } from 'next';
import { CustomRoleStart } from '@/components/CustomRoleStart';

export const metadata: Metadata = {
  title: 'Tailored interview practice',
  robots: { index: false, follow: true },
};

export default async function CustomPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const focusQuestionId = typeof query.focus === 'string' && query.focus.length <= 160 ? query.focus : undefined;
  const initialLanguage = query.lang === 'ar' || query.lang === 'en' ? query.lang : undefined;
  return <CustomRoleStart focusQuestionId={focusQuestionId} initialLanguage={initialLanguage} />;
}
