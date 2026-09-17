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
      const evidence = state.evidence_ledger.filter((entry) => evidenceIds.includes(entry.id));
      const latest = evidence.at(-1);
      const expectedCriteria = latest ? Object.entries(latest.criteria) : [];
      const missing = expectedCriteria
        .filter(([, status]) => status === 'MISSING' || status === 'WEAK')
        .map(([criterion]) => criterion.replaceAll('_', ' '));
      const summary = latest?.summary.trim().replaceAll('—', ',').slice(0, 360) ?? '';

      let workedPrefix = `Your example showed ${competency.name.toLowerCase()}: `;
      if (latest?.evidence_type === 'HYPOTHETICAL') {
        workedPrefix = `In the situational scenario, your structured reasoning showed ${competency.name.toLowerCase()}: `;
      } else if (latest?.evidence_type === 'ACADEMIC') {
        workedPrefix = `Your academic project demonstrated ${competency.name.toLowerCase()}: `;
      } else if (latest?.evidence_type === 'VOLUNTEER' || latest?.evidence_type === 'PERSONAL_PROJECT') {
        workedPrefix = `Your practical project demonstrated ${competency.name.toLowerCase()}: `;
      } else if (latest?.evidence_type === 'INTERNSHIP') {
        workedPrefix = `Your internship experience demonstrated ${competency.name.toLowerCase()}: `;
      }

      return {
        id: competency.id,
        what_worked: summary ? `${workedPrefix}${summary}` : '',
        what_is_missing: evidenceIds.length
          ? (missing.length ? `The response still needs clearer ${missing.slice(0, 2).join(' and ')}.` : '')
          : `No direct example or situational reasoning yet showed ${competency.name.toLowerCase()}.`,
        improve_this: evidenceIds.length
          ? (missing.length
              ? `Add the ${missing[0]} to your response for ${competency.name.toLowerCase()}.`
              : `Keep the key outcome or result clear when addressing ${competency.name.toLowerCase()}.`)
          : `Give an example from university, projects, work or explain how you would tackle a realistic scenario showing ${competency.name.toLowerCase()}.`,
        evidence_ids: evidenceIds,
      };
    }),
    patterns: [],
    single_highest_value_improvement: recommended
      ? `Strengthen your response for ${recommended.competency.name.toLowerCase()} with the missing action or outcome.`
      : 'Keep your strongest examples concise and specific.',
    retry_recommended_question: Math.max(1, Math.min(state.plan.length, recommended
      ? state.plan.find((question) => question.target_competencies.includes(recommended.competency.id))?.slot ?? 1
      : 1)),
  };
}
