import type { Question, Role } from '@/lib/roles/shared';
import type { AnswerFeedback } from '@/lib/scoring';
import { buildSampleAnswer, plainDash } from './sample-answer';
import { SevenDayPlanSchema, type PlanMode, type PlanReport, type SevenDayPlan } from './schema';

export type PlanInput = {
  locale: 'en' | 'ar';
  mode: PlanMode;
  /** The question the candidate answered in the first session. */
  focusQuestionId: string;
  /** The candidate's own feedback for that question, when the server can read it. */
  feedback?: AnswerFeedback | null;
};

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function clip(value: string, max: number): string {
  const clean = plainDash(value);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function planReportFromFeedback(feedback: AnswerFeedback | null | undefined): PlanReport | null {
  if (!feedback) return null;
  return {
    headline: clip(feedback.headline, 300),
    score: feedback.status === 'scored' ? Math.round(feedback.score) : null,
    strengths: feedback.strengths.slice(0, 3).map((item) => clip(item, 400)),
    improvements: feedback.improvements.slice(0, 3).map((item) => clip(item, 400)),
    coachTip: clip(feedback.coachTip, 600),
  };
}

/**
 * Seven questions, one a day, drawn from the role's own set and its bank in a
 * fixed order so every email for the same plan agrees. The answered question
 * is not repeated unless the role is too small to fill a week.
 */
export function pickPlanQuestions(role: Role, focusQuestionId: string): Question[] {
  const pool = [...role.questions, ...(role.bank ?? [])];
  const seen = new Set<string>();
  const unique = pool.filter((question) => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
  const others = unique.filter((question) => question.id !== focusQuestionId);
  const chosen = others.slice(0, 7);
  let index = 0;
  while (chosen.length < 7 && unique.length > 0) {
    chosen.push(unique[index % unique.length]);
    index += 1;
  }
  return chosen;
}

export function buildSevenDayPlan(role: Role, input: PlanInput): SevenDayPlan {
  const ar = input.locale === 'ar';
  const all = [...role.questions, ...(role.bank ?? [])];
  const focus = all.find((question) => question.id === input.focusQuestionId) ?? role.questions[0];
  if (!focus) throw new Error('role_has_no_questions');
  const questions = pickPlanQuestions(role, focus.id);
  if (questions.length !== 7) throw new Error('role_too_small_for_plan');

  return SevenDayPlanSchema.parse({
    version: '2',
    locale: input.locale,
    mode: input.mode,
    roleId: role.id,
    roleTitle: clip(ar ? role.titleAr : role.title, 160),
    focusQuestionId: focus.id,
    focusQuestionText: clip(ar ? focus.textAr : focus.text, 600),
    sampleAnswer: buildSampleAnswer(role, focus, input.locale).map((paragraph) => clip(paragraph, 700)),
    report: planReportFromFeedback(input.feedback),
    days: DAYS.map((day, index) => {
      const question = questions[index];
      return {
        day,
        questionId: question.id,
        questionText: clip(ar ? question.textAr : question.text, 600),
        hint: clip(ar ? question.hintAr : question.hint, 600),
        tags: (question.tags ?? []).slice(0, 2),
      };
    }),
  });
}

export type PlanLinks = {
  /** Private browser copy of the whole plan. */
  view: string;
  /** Deep link for each day, index 0 is day 1. Each lands on that question in the chosen mode. */
  days: string[];
  /** Single wa.me link carrying all seven deep links. No phone number is asked for. */
  whatsapp: string;
};

/** The deep link the flow reads: focus, mode and language all in the query string. */
export function practiceDeepLink(origin: string, plan: Pick<SevenDayPlan, 'roleId' | 'mode' | 'locale'>, questionId: string): string {
  const url = new URL(`/practice/${encodeURIComponent(plan.roleId)}`, origin);
  url.searchParams.set('focus', questionId);
  url.searchParams.set('mode', plan.mode);
  url.searchParams.set('lang', plan.locale);
  return url.toString();
}

/**
 * Each daily link goes through the plan's own landing page so the click can be
 * counted and local progress attached, then forwards to the practice deep link.
 */
export function planDayLink(origin: string, viewToken: string, day: number): string {
  const url = new URL(`/practice-plan/${encodeURIComponent(viewToken)}`, origin);
  url.searchParams.set('day', String(day));
  return url.toString();
}

export function whatsappLink(plan: SevenDayPlan, dayLinks: string[]): string {
  const ar = plan.locale === 'ar';
  const lines = [
    ar ? `خطة التدريب لسبعة أيام لوظيفة ${plan.roleTitle} من مقابلة:` : `My seven-day ${plan.roleTitle} interview plan from Muqabala:`,
    ...plan.days.map((day, index) => `${ar ? 'اليوم' : 'Day'} ${day.day}: ${dayLinks[index]}`),
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function buildPlanLinks(origin: string, viewToken: string, plan: SevenDayPlan): PlanLinks {
  const days = plan.days.map((day) => planDayLink(origin, viewToken, day.day));
  return {
    view: new URL(`/practice-plan/${encodeURIComponent(viewToken)}`, origin).toString(),
    days,
    whatsapp: whatsappLink(plan, days),
  };
}
