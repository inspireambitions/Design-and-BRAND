'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { readPracticeSearchParams } from '@/lib/practice-search-params';
import { CustomRoleStart } from './CustomRoleStart';

function WithSearchParams() {
  const { focusQuestionId, initialLanguage } = readPracticeSearchParams(useSearchParams());
  return <CustomRoleStart focusQuestionId={focusQuestionId} initialLanguage={initialLanguage} />;
}

/**
 * Lets `/practice/custom` be prerendered at build time. The `focus` and `lang`
 * parameters are read in the browser; the static HTML holds the same form
 * without them, so nothing is missing from first paint.
 */
export function CustomRoleStartFromSearch() {
  return (
    <Suspense fallback={<CustomRoleStart />}>
      <WithSearchParams />
    </Suspense>
  );
}
