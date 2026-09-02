import { notFound } from 'next/navigation';
import { shortlistHtml, shortlistSubject, shortlistText, type ShortlistInput } from '@/lib/employer-volume/shortlist-message';

export const dynamic = 'force-dynamic';

/**
 * Renders the shortlist email with sample data so it can be checked in Gmail,
 * Outlook and iOS Mail through an email testing tool. Never available in
 * production. Add ?text=1 for the plain-text part.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') notFound();
  const coverage = (marks: boolean[]) => ({
    items: marks.map((covered, index) => ({ id: `c${index}`, label: ['Communication', 'Ownership', 'Problem solving', 'Specific evidence'][index], labelAr: '', covered })),
    covered: marks.filter(Boolean).length,
    total: marks.length,
    full: marks.every(Boolean),
  });
  const sample: ShortlistInput = {
    roleTitle: 'Receptionist',
    employerName: 'Nour Clinic',
    invited: 223,
    answered: 41,
    fullCoverage: 7,
    rows: [
      { displayName: 'Aisha R.', coverage: coverage([true, true, true, true]), firstAnswer: 'I worked on the front desk of a 120 bed clinic for three years and handled check in, calls and...', openUrl: 'https://trymuqabala.com/auth/confirm?token_hash=sample&type=magiclink&next=%2Femployer%2Finterviews%2Fsample' },
      { displayName: 'MQ-7KQ2ND', coverage: coverage([true, true, true, false]), firstAnswer: 'My last role was at a dental practice where I booked appointments and looked after the waiting...', openUrl: 'https://trymuqabala.com/employer' },
      { displayName: 'Marvin D.', coverage: coverage([true, false, true, false]), firstAnswer: 'I have two years in hotel reception and I am good with people who are upset.', openUrl: 'https://trymuqabala.com/employer' },
    ],
  };
  const url = new URL(request.url);
  if (url.searchParams.get('text')) {
    return new Response(`Subject: ${shortlistSubject(sample)}\n\n${shortlistText(sample)}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(shortlistHtml(sample), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
