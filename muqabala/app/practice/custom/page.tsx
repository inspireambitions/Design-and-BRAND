import type { Metadata } from 'next';
import { CustomRoleStart } from '@/components/CustomRoleStart';

export const metadata: Metadata = {
  title: 'Tailored interview practice',
  robots: { index: false, follow: true },
};

export default function CustomPracticePage() {
  return <CustomRoleStart />;
}
