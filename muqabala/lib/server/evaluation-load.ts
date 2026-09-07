import 'server-only';

import { generateCandidateEvaluationReport, loadOwnedEvaluationReport } from './evaluation-report';
import { reportOperationalFailure, reportOperationalEvent } from '@/lib/sentry-server';
import { LegacyEvaluationUnavailableError } from '@/lib/evaluation-availability';

/** Preserve encrypted evidence on failure. Never substitute an incomplete report. */
export async function loadEvaluationForEmployer(interviewId: string, employerId: string) {
  try {
    let current = await loadOwnedEvaluationReport(interviewId, employerId);
    if (!current) {
      await generateCandidateEvaluationReport(interviewId);
      current = await loadOwnedEvaluationReport(interviewId, employerId);
    }
    return { current, failed: false, legacy: false };
  } catch (error) {
    if (error instanceof LegacyEvaluationUnavailableError) {
      reportOperationalEvent('evaluation_legacy_review_available', { area: 'evaluation', code: 'predates_timed_evidence' });
      return { current: null, failed: false, legacy: true };
    }
    reportOperationalFailure('evaluation_report_load_failed', {
      area: 'evaluation', route: '/employer/candidates/[id]/evaluation',
      code: error instanceof Error ? error.name : 'unknown',
    });
    return { current: null, failed: true, legacy: false };
  }
}
