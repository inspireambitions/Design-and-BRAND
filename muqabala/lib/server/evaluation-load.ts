import 'server-only';

import { generateCandidateEvaluationReport, loadOwnedEvaluationReport } from './evaluation-report';
import { reportOperationalFailure } from '@/lib/sentry-server';

/** Preserve encrypted evidence on failure. Never substitute an incomplete report. */
export async function loadEvaluationForEmployer(interviewId: string, employerId: string) {
  try {
    let current = await loadOwnedEvaluationReport(interviewId, employerId);
    if (!current) {
      await generateCandidateEvaluationReport(interviewId);
      current = await loadOwnedEvaluationReport(interviewId, employerId);
    }
    return { current, failed: false };
  } catch (error) {
    reportOperationalFailure('evaluation_report_load_failed', {
      area: 'evaluation', route: '/employer/candidates/[id]/evaluation',
      code: error instanceof Error ? error.name : 'unknown',
    });
    return { current: null, failed: true };
  }
}
