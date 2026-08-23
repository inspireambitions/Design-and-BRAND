import { q, opener, closer, serviceCompetencies, type Role } from './shared';

export const CUSTOM_ROLE_ID = 'custom';

/**
 * The catch-all interview. No role library can list every job, so a candidate whose
 * job is not in the catalogue types their own title and gets a general interview
 * built from questions that work for any role. The typed title is passed to the
 * scorer so AI feedback is specific to their actual job.
 */
export function buildCustomRole(title?: string): Role {
  const jobTitle = (title ?? '').trim();
  return {
    id: CUSTOM_ROLE_ID,
    title: jobTitle || 'Your role',
    titleAr: jobTitle || 'وظيفتك',
    industry: 'Any industry',
    industryAr: 'أي قطاع',
    level: 'Mid',
    blurb: 'A general interview that works for any job — type your own job title.',
    blurbAr: 'مقابلة عامة تصلح لأي وظيفة — اكتب المسمى الوظيفي الخاص بك.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'proudest',
        'Tell me about something you achieved at work that you are proud of.',
        'حدثني عن إنجاز في عملك تفتخر به.',
        ['evidence', 'ownership', 'communication'],
      ),
      q(
        'difficult_situation',
        'Tell me about a difficult situation at work and how you handled it.',
        'حدثني عن موقف صعب في العمل وكيف تعاملت معه.',
        ['problem_solving', 'ownership', 'customer_focus', 'evidence'],
      ),
      q(
        'pressure',
        'Tell me about a time you were under real pressure at work. What did you do?',
        'حدثني عن مرة كنت فيها تحت ضغط حقيقي في العمل. ماذا فعلت؟',
        ['problem_solving', 'ownership', 'communication'],
      ),
      q(
        'teamwork',
        'Tell me about a time you worked with other people to reach an important goal.',
        'حدثني عن مرة عملت فيها مع أشخاص آخرين لتحقيق هدف مهم.',
        ['communication', 'ownership', 'evidence'],
      ),
      q(
        'mistake',
        'Tell me about a mistake you made at work. How did you put it right?',
        'حدثني عن خطأ ارتكبته في العمل. كيف صححته؟',
        ['ownership', 'problem_solving', 'evidence'],
      ),
      q(
        'strength_weakness',
        'What is the one thing you are best at in your work, and what are you still working on?',
        'ما أفضل ما تتقنه في عملك، وما الذي ما زلت تعمل على تحسينه؟',
        ['communication', 'evidence', 'ownership'],
        'Give an example for each. A real weakness with a real plan beats a fake one.',
        'اذكر مثالاً لكل منهما. نقطة ضعف حقيقية مع خطة حقيقية أفضل من إجابة مصطنعة.',
        20,
        90,
      ),
      closer,
    ],
  };
}
