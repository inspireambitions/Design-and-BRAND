import type { InterventionSignal } from './types';

export type InterventionInput = {
  cohortId: string;
  members: Array<{
    student_user_id: string;
    display_name: string;
    student_identifier?: string | null;
  }>;
  assignments: Array<{
    id: string;
    role_id: string;
    job_title?: string | null;
    due_at: string;
    status?: string;
  }>;
  attempts: Array<{
    id: string;
    assignment_id: string;
    student_user_id: string;
    attempt_number: number;
    status: string;
    submitted_at?: string | null;
    created_at?: string;
    evidence_covered?: number | null;
  }>;
  supportRequests?: Array<{
    student_user_id: string;
    status: string;
    note?: string;
    created_at?: string;
  }>;
  now?: number;
};

export function detectInterventionSignals({
  members,
  assignments,
  attempts,
  supportRequests = [],
  now = Date.now(),
}: InterventionInput): InterventionSignal[] {
  const signals: InterventionSignal[] = [];

  for (const member of members) {
    const studentId = member.student_user_id;
    const studentName = member.display_name;
    const studentIdentifier = member.student_identifier;

    // Check open adviser support requests
    const openSupport = supportRequests.find(
      (s) => s.student_user_id === studentId && s.status !== 'closed'
    );
    if (openSupport) {
      signals.push({
        id: `support_${studentId}`,
        studentId,
        studentName,
        studentIdentifier,
        assignmentId: assignments[0]?.id ?? 'general',
        assignmentRole: assignments[0]?.job_title || assignments[0]?.role_id || 'General Support',
        category: 'support_requested',
        severity: 'urgent',
        humanReason: 'Learner submitted an active adviser support request.',
        evidenceBasis: `Support request open: "${openSupport.note || 'Assistance requested by student'}"`,
        timestamp: openSupport.created_at || new Date(now).toISOString(),
        suggestedAction: 'Respond to support request and schedule 1-on-1 guidance',
      });
    }

    for (const assignment of assignments) {
      const assignmentId = assignment.id;
      const assignmentRole = assignment.job_title || assignment.role_id;
      const dueTime = new Date(assignment.due_at).getTime();
      const msUntilDue = dueTime - now;

      // Filter attempts for this student & assignment
      const studentAttempts = attempts.filter(
        (a) => a.student_user_id === studentId && a.assignment_id === assignmentId
      ).sort((a, b) => a.attempt_number - b.attempt_number);

      const submittedAttempts = studentAttempts.filter(
        (a) => a.status === 'submitted' || Boolean(a.submitted_at)
      );
      const activeDraft = studentAttempts.find((a) => a.status === 'draft');

      // 1. Deadline approaching unstarted (due within 48h, no attempts started)
      if (studentAttempts.length === 0 && msUntilDue > 0 && msUntilDue <= 48 * 3600 * 1000) {
        const hoursLeft = Math.round(msUntilDue / (3600 * 1000));
        signals.push({
          id: `deadline_${studentId}_${assignmentId}`,
          studentId,
          studentName,
          studentIdentifier,
          assignmentId,
          assignmentRole,
          category: 'deadline_unstarted',
          severity: 'urgent',
          humanReason: `Assignment is due in ${hoursLeft} hours, but the learner has not started an attempt.`,
          evidenceBasis: `Due at ${new Date(assignment.due_at).toISOString()}, 0 attempts recorded.`,
          timestamp: new Date(now).toISOString(),
          suggestedAction: 'Send automated deadline reminder or reach out directly',
        });
      }

      // 2. Stalled draft (draft created > 48 hours ago, not yet submitted)
      if (activeDraft && activeDraft.created_at) {
        const draftAgeMs = now - new Date(activeDraft.created_at).getTime();
        if (draftAgeMs >= 48 * 3600 * 1000 && msUntilDue > 0) {
          const hoursStalled = Math.round(draftAgeMs / (3600 * 1000));
          signals.push({
            id: `stalled_${studentId}_${assignmentId}`,
            studentId,
            studentName,
            studentIdentifier,
            assignmentId,
            assignmentRole,
            category: 'stalled_draft',
            severity: 'advisory',
            humanReason: `Draft attempt has been open for ${hoursStalled} hours without submission.`,
            evidenceBasis: `Draft created on ${new Date(activeDraft.created_at).toISOString()}, revision not finalized.`,
            timestamp: new Date(now).toISOString(),
            suggestedAction: 'Prompt learner to complete answer drafting and submit',
          });
        }
      }

      // 3. Low evidence coverage on latest submission (< 50% of rubric elements, e.g. < 6 of 12)
      if (submittedAttempts.length > 0) {
        const latest = submittedAttempts[submittedAttempts.length - 1];
        if (typeof latest.evidence_covered === 'number' && latest.evidence_covered < 6) {
          signals.push({
            id: `low_evidence_${studentId}_${assignmentId}_att${latest.attempt_number}`,
            studentId,
            studentName,
            studentIdentifier,
            assignmentId,
            assignmentRole,
            category: 'low_evidence',
            severity: 'urgent',
            humanReason: `Latest submitted attempt demonstrated low observed evidence (${latest.evidence_covered} elements).`,
            evidenceBasis: `Attempt ${latest.attempt_number} covered ${latest.evidence_covered} rubric evidence element(s).`,
            timestamp: latest.submitted_at || new Date(now).toISOString(),
            suggestedAction: 'Review feedback with learner to identify missing behavioral examples',
          });
        }
      }

      // 4. Stagnant attempts (2+ submitted attempts without improvement in evidence covered)
      if (submittedAttempts.length >= 2) {
        const first = submittedAttempts[0];
        const latest = submittedAttempts[submittedAttempts.length - 1];
        if (
          typeof first.evidence_covered === 'number' &&
          typeof latest.evidence_covered === 'number' &&
          latest.evidence_covered <= first.evidence_covered
        ) {
          signals.push({
            id: `stagnant_${studentId}_${assignmentId}`,
            studentId,
            studentName,
            studentIdentifier,
            assignmentId,
            assignmentRole,
            category: 'stagnant_attempts',
            severity: 'advisory',
            humanReason: `Learner submitted ${submittedAttempts.length} attempts without an increase in rubric evidence.`,
            evidenceBasis: `Attempt 1: ${first.evidence_covered} element(s); Attempt ${latest.attempt_number}: ${latest.evidence_covered} element(s).`,
            timestamp: latest.submitted_at || new Date(now).toISOString(),
            suggestedAction: 'Schedule 1-on-1 interview practice to address persistent missing competencies',
          });
        }
      }
    }
  }

  // Sort signals: urgent first, then by timestamp descending
  return signals.sort((a, b) => {
    if (a.severity === 'urgent' && b.severity !== 'urgent') return -1;
    if (a.severity !== 'urgent' && b.severity === 'urgent') return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
