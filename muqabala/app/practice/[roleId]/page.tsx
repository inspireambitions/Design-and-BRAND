import { notFound } from 'next/navigation';
import { ROLES, getRole } from '@/lib/roles';
import { PracticeInterview } from '@/components/PracticeInterview';

export function generateStaticParams() {
  return ROLES.map((role) => ({ roleId: role.id }));
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
