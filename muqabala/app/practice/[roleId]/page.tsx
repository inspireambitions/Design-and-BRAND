import { notFound } from 'next/navigation';
import { ROLES, getRole } from '@/lib/roles';
import { InterviewFlow } from '@/components/InterviewFlow';

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

  return <InterviewFlow role={role} />;
}
