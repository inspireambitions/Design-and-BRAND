import { ROLES } from '@/lib/roles';
import { HomeView } from '@/components/HomeView';

export default function HomePage() {
  return <HomeView roles={ROLES} />;
}
