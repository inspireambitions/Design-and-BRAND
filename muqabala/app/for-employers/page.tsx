import type { Metadata } from 'next';
import { EmployerProofCreate } from '@/components/EmployerProofCreate';

export const metadata: Metadata = {
  title: 'Work sample for hiring teams | Muqabala',
  description: 'Keep your career portal. Add a 12-minute work sample. Humans decide. No face scoring. No auto-reject.',
  robots: { index: true, follow: true },
};

export default function ForEmployersPage() {
  return <EmployerProofCreate />;
}
