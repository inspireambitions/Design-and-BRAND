'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/roles';
import { readPracticeSearchParams } from '@/lib/practice-search-params';
import { PracticeInterview } from './PracticeInterview';

function WithSearchParams({ role }: { role: Role }) {
  const { focusQuestionId, initialLanguage } = readPracticeSearchParams(useSearchParams());
  return <PracticeInterview role={role} focusQuestionId={focusQuestionId} initialLanguage={initialLanguage} />;
}

/**
 * Lets `/practice/[roleId]` be prerendered at build time. Reading the query
 * string on the server would make every role page render on demand, so the
 * `focus` and `lang` parameters are read in the browser instead.
 *
 * The fallback is the same interview without those parameters. It is what the
 * static HTML contains, so first paint, previews and the deployed-copy tests
 * still see the full page; the browser swaps in the focused or Arabic variant
 * as soon as it hydrates.
 */
export function PracticeInterviewFromSearch({ role }: { role: Role }) {
  return (
    <Suspense fallback={<PracticeInterview role={role} />}>
      <WithSearchParams role={role} />
    </Suspense>
  );
}
