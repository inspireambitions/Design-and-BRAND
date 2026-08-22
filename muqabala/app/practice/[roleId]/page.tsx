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
    robots: { index: false, follow: true },
  };
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  const role = getRole(roleId);
  if (!role) notFound();

  return <PracticeInterview role={role} />;
}
