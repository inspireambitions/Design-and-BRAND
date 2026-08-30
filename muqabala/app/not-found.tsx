import Link from 'next/link';
import { MuqabalaMark } from '@/components/MarketingSite';

export default function NotFound() {
  return (
    <main className="not-found marketing-wrap">
      <MuqabalaMark />
      <p className="marketing-eyebrow">Page not found</p>
      <h1>This page is not part of the interview.</h1>
      <p>Return to Muqabala or choose a practice interview.</p>
      <div className="marketing-cta-row">
        <Link href="/" className="marketing-button">Go to homepage</Link>
        <Link href="/practice" className="marketing-text-link">Start practising</Link>
      </div>
    </main>
  );
}
