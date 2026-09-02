import type { FeedbackModelOutput, FinalFeedback, InterviewState } from './types.ts';

export function coverageBand(status: InterviewState['coverage'][string]['status']): FinalFeedback['competencies'][number]['band'] {
  if (status === 'STRONG') return 'Strong evidence';
  if (status === 'PARTIAL' || status === 'SUFFICIENT') return 'Developing evidence';
  return 'Missing evidence';
}

export function buildFinalFeedback(state: InterviewState, output: FeedbackModelOutput): FinalFeedback {
  const byId = new Map(output.competencies.map((item) => [item.id, item]));
  const competencies = state.blueprint.map((competency) => {
    const item = byId.get(competency.id) ?? {
      id: competency.id,
      what_worked: '',
      what_is_missing: 'No usable evidence was recorded for this competency.',
      improve_this: 'Use one clear example and state what changed because of your actions.',
      evidence_ids: [],
    };
    return { ...item, band: coverageBand(state.coverage[competency.id]?.status ?? 'NO_EVIDENCE') };
  });
  const caveats: string[] = [];
  if (!state.role_pack.technical_reference) {
    caveats.push('Technical accuracy was not verified in this practice interview.');
  }
  if (state.role_pack.assessment_type === 'PRACTICAL') {
    caveats.push('This role is also commonly assessed through a practical test.');
  }
  if (state.role_pack.assessment_type === 'PORTFOLIO') {
    caveats.push('This role is also commonly assessed through a portfolio review.');
  }
  if (state.profile.career_change) {
    caveats.push('Your competency evidence and your direct industry evidence were considered separately.');
  }
  return { ...output, competencies, caveats };
}

export function deterministicFeedbackFallback(state: InterviewState): FeedbackModelOutput {
  const recommended = state.blueprint
    .map((competency) => ({ competency, status: state.coverage[competency.id]?.status ?? 'NO_EVIDENCE' }))
    .find(({ status }) => status === 'NO_EVIDENCE' || status === 'WEAK' || status === 'PARTIAL');
  return {
    competencies: state.blueprint.map((competency) => {
      const evidenceIds = state.coverage[competency.id]?.evidence_ids ?? [];
      return {
        id: competency.id,
        what_worked: evidenceIds.length ? 'The interview recorded relevant evidence for this area.' : '',
        what_is_missing: evidenceIds.length ? 'The available evidence needs more detail.' : 'No usable evidence was recorded.',
        improve_this: 'Give one clear example. State your action and the result.',
        evidence_ids: evidenceIds,
      };
    }),
    patterns: [],
    single_highest_value_improvement: recommended
      ? `Give a clearer example of ${recommended.competency.name.toLowerCase()}, including your action and result.`
      : 'Keep your strongest examples concise and specific.',
    retry_recommended_question: Math.max(1, Math.min(state.plan.length, recommended
      ? state.plan.find((question) => question.target_competencies.includes(recommended.competency.id))?.slot ?? 1
      : 1)),
  };
}
