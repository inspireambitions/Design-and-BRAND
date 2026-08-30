import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ROLES, getRole } from '@/lib/roles';
import { PracticeInterview } from '@/components/PracticeInterview';

export function generateStaticParams() {
  return ROLES.map((role) => ({ roleId: role.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roleId: string }>;
}): Promise<Metadata> {
  const { roleId } = await params;
  const role = getRole(roleId);
  return {
    title: role ? `${role.title} interview practice` : 'Interview practice',
    robots: { index: true, follow: true },
    alternates: { canonical: `/practice/${roleId}` },
  };
}

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<{ focus?: string | string[]; lang?: string | string[] }>;
}) {
  const { roleId } = await params;
  const query = await searchParams;
  const focusQuestionId = typeof query.focus === 'string' && query.focus.length <= 160
    ? query.focus
    : undefined;
  const initialLanguage = query.lang === 'ar' || query.lang === 'en' ? query.lang : undefined;
  const role = getRole(roleId);
  if (!role) notFound();

  return <PracticeInterview role={role} focusQuestionId={focusQuestionId} initialLanguage={initialLanguage} />;
}
