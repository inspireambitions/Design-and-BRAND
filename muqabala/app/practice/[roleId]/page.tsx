import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ROLES, getRole } from '@/lib/roles';
import { PracticeInterviewFromSearch } from '@/components/PracticeInterviewFromSearch';

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

// Prerendered for every catalogue role. The `focus` and `lang` query
// parameters are read in the browser (see PracticeInterviewFromSearch) so that
// this page never has to render on demand.
export default async function PracticePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  const role = getRole(roleId);
  if (!role) notFound();

  return <PracticeInterviewFromSearch role={role} />;
}
