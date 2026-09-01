import type { Metadata } from 'next';
import { CustomRoleStartFromSearch } from '@/components/CustomRoleStartFromSearch';

export const metadata: Metadata = {
  title: 'Tailored interview practice',
  robots: { index: false, follow: true },
};

// Prerendered at build time. The `focus` and `lang` query parameters are read
// in the browser (see CustomRoleStartFromSearch).
export default function CustomPracticePage() {
  return <CustomRoleStartFromSearch />;
}
