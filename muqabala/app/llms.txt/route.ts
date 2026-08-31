import { sanityClient } from '@/lib/sanity/client';
import { guidesQuery, type GuideListItem } from '@/lib/sanity/queries';

export const revalidate = 3600;

const BASE_URL = 'https://trymuqabala.com';

const staticSections = `# Muqabala

> Muqabala is a free interview practice tool for candidates applying to jobs in the Gulf (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman). Candidates practise real Gulf interview questions out loud — in English or Arabic — and get honest, content-only feedback. Muqabala scores the answer, never the accent, face, appearance or personality. No account is required to practise.

Key facts:
- Free and unlimited practice, no sign-up needed to start.
- Works in English and Arabic, including right-to-left Arabic UI.
- Scoring covers answer content only; face, accent, pronunciation, grammar fluency and emotion are explicitly excluded.
- Camera is optional: typing an answer gives the same content feedback.
- Practice is private to the candidate; employers do not see recordings or practice history.
- Built by Inspire Ambitions (https://inspireambitions.com).

## Product

- [Home](${BASE_URL}/): What Muqabala is and how to start practising.
- [Practice](${BASE_URL}/practice): Start a practice interview for a Gulf job role.
- [Interview roles](${BASE_URL}/interview-roles): Job roles Muqabala covers.
- [How it works](${BASE_URL}/how-it-works): The practice flow step by step.
- [How feedback works](${BASE_URL}/how-feedback-works): What is scored and what is never scored.
- [For employers](${BASE_URL}/for-employers): Employer-facing information.
- [FAQ](${BASE_URL}/faq): Cost, privacy, Arabic support, cameras and scoring policy.
- [About](${BASE_URL}/about): Who builds Muqabala and why.

## Policies

- [Privacy](${BASE_URL}/privacy)
- [Terms](${BASE_URL}/terms)
- [Accessibility](${BASE_URL}/accessibility)
`;

export async function GET() {
  const guides = await sanityClient.fetch<GuideListItem[]>(guidesQuery).catch(() => []);
  const guideLines = (guides ?? [])
    .map((guide) => {
      const excerpt = guide.excerpt ? `: ${guide.excerpt}` : '';
      return `- [${guide.title}](${BASE_URL}/guides/${guide.slug})${excerpt}`;
    })
    .join('\n');
  const guidesSection = guideLines
    ? `\n## Guides\n\nInterview guides for Gulf job seekers, updated regularly.\n\n- [All guides](${BASE_URL}/guides)\n${guideLines}\n`
    : '';
  return new Response(staticSections + guidesSection, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
