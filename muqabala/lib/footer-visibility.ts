export type PracticeFooterStage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';
export type EmployerInterviewFooterStage = 'resuming' | 'unavailable' | 'intro' | 'device' | 'ready' | 'recording' | 'saving' | 'consent' | 'submitting' | 'complete';
export type UniversalInterviewFooterStage = 'SETUP' | 'CONFIRM' | 'INTERVIEW' | 'FEEDBACK_LOADING' | 'FEEDBACK' | 'DELETED';

export function hidePracticeFooter(
  stage: PracticeFooterStage,
  feedbackReady: boolean,
  deviceCheckActive = false,
): boolean {
  return (stage === 'check' && deviceCheckActive)
    || stage === 'record'
    || stage === 'review'
    || (stage === 'feedback' && !feedbackReady);
}

export function hideEmployerInterviewFooter(stage: EmployerInterviewFooterStage): boolean {
  return stage === 'resuming'
    || stage === 'device'
    || stage === 'recording'
    || stage === 'saving'
    || stage === 'consent'
    || stage === 'submitting';
}

export function hideUniversalInterviewFooter(stage: UniversalInterviewFooterStage): boolean {
  return stage === 'INTERVIEW' || stage === 'FEEDBACK_LOADING';
}
