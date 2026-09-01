import { q, type Question } from './shared';

/**
 * Shared question banks, one per competency family.
 *
 * A tester found that practising a role twice gives the identical five
 * questions, which turns "practise until ready" into rehearsing memorised
 * answers. These banks give every catalogue role a pool to rotate through, so
 * a second attempt is a fresh interview.
 *
 * The questions are deliberately cross-industry behavioural questions: 
 * real first-round staples: written to the same standard as the role
 * questions: short, spoken, one thing at a time, both languages, with hints
 * that coach rather than answer. Each family's questions score only against
 * competency ids that family defines.
 */

/** Roles built on serviceCompetencies (customer_focus present). */
export const serviceBank: Question[] = [
  q(
    'svc_worst_day',
    'Tell me about a shift when everything went wrong at once. How did you get through it?',
    'حدثني عن نوبة عمل سار فيها كل شيء بشكل خاطئ دفعة واحدة. كيف تجاوزت ذلك؟',
    ['problem_solving', 'ownership', 'communication'],
  ),
  q(
    'svc_difficult_colleague',
    'Tell me about a colleague you found difficult to work with. How did you handle it?',
    'حدثني عن زميل وجدت صعوبة في العمل معه. كيف تعاملت مع الأمر؟',
    ['communication', 'ownership'],
    'Stay respectful: the interviewer is watching how you talk about people as much as what you did.',
    'حافظ على الاحترام: المُحاور يراقب طريقة حديثك عن الآخرين بقدر ما يراقب ما فعلته.',
  ),
  q(
    'svc_mistake_bank',
    'Tell me about a mistake you made at work. What did you do next?',
    'حدثني عن خطأ ارتكبته في العمل. ماذا فعلت بعد ذلك؟',
    ['ownership', 'evidence', 'communication'],
    'Owning it and fixing it is the whole answer. Say what changed afterwards.',
    'الاعتراف بالخطأ وإصلاحه هو الإجابة كاملة. اذكر ما الذي تغيّر بعد ذلك.',
  ),
  q(
    'svc_regular',
    'Tell me about a customer or guest you served often. What kept them coming back to you?',
    'حدثني عن عميل أو نزيل كنت تخدمه باستمرار. ما الذي جعله يعود إليك تحديداً؟',
    ['customer_focus', 'evidence', 'communication'],
  ),
  q(
    'svc_new_job',
    'Think of your first weeks in a new job. How did you learn the way things were done?',
    'تذكّر أسابيعك الأولى في وظيفة جديدة. كيف تعلمت طريقة العمل هناك؟',
    ['ownership', 'communication', 'evidence'],
  ),
  q(
    'svc_two_customers',
    'Two customers need you at the same moment. Walk me through exactly what you do.',
    'عميلان يحتاجانك في اللحظة نفسها. اشرح لي بالضبط ماذا تفعل.',
    ['problem_solving', 'customer_focus', 'communication'],
    'Show the order you choose and what you say to the one who waits.',
    'أظهر الترتيب الذي تختاره وما تقوله لمن ينتظر.',
  ),
];

/** Roles built on technicalCompetencies (compliance present, customer_focus absent). */
export const technicalBank: Question[] = [
  q(
    'tec_learn_fast',
    'Tell me about a time you had to learn a new tool, machine or system quickly.',
    'حدثني عن مرة اضطررت فيها لتعلم أداة أو آلة أو نظام جديد بسرعة.',
    ['problem_solving', 'evidence', 'ownership'],
  ),
  q(
    'tec_hard_deadline',
    'Tell me about a job that had to be finished by a hard deadline. How did you make it?',
    'حدثني عن عمل كان يجب إنهاؤه في موعد نهائي صارم. كيف أنجزته؟',
    ['ownership', 'problem_solving', 'evidence'],
  ),
  q(
    'tec_cut_corners',
    'Tell me about a time you were pushed to cut corners. What did you do?',
    'حدثني عن مرة تعرضت فيها لضغط للتهاون في العمل. ماذا فعلت؟',
    ['compliance', 'ownership', 'communication'],
    'The right answer holds the standard. Show how you said it without making an enemy.',
    'الإجابة الصحيحة هي التمسك بالمعيار. أظهر كيف قلتها دون أن تخلق عداوة.',
  ),
  q(
    'tec_unclear_instructions',
    'You are given instructions that are not clear. What do you do before starting the work?',
    'تُعطى تعليمات غير واضحة. ماذا تفعل قبل بدء العمل؟',
    ['communication', 'compliance', 'problem_solving'],
  ),
  q(
    'tec_report_up',
    'Walk me through how you report a problem you cannot fix yourself.',
    'اشرح لي كيف تبلّغ عن مشكلة لا تستطيع إصلاحها بنفسك.',
    ['communication', 'compliance', 'evidence'],
    'Who you tell, what you tell them, and what you do while you wait.',
    'من تُبلغ، وماذا تقول له، وماذا تفعل أثناء الانتظار.',
  ),
  q(
    'tec_improved_something',
    'Tell me about something you improved at work: a fix, a habit, a way of setting up.',
    'حدثني عن شيء حسّنته في عملك: إصلاح أو عادة أو طريقة تجهيز.',
    ['ownership', 'evidence', 'problem_solving'],
  ),
];

/** Roles built on careCompetencies (same ids as technical; judgement and dignity focus). */
export const careBank: Question[] = [
  q(
    'care_stay_calm',
    'Tell me about a time you had to stay calm for someone else’s sake.',
    'حدثني عن مرة اضطررت فيها للحفاظ على هدوئك من أجل شخص آخر.',
    ['communication', 'ownership', 'problem_solving'],
  ),
  q(
    'care_family_conversation',
    'Tell me about a difficult conversation with a family member of someone in your care.',
    'حدثني عن محادثة صعبة مع أحد أقارب شخص كان في رعايتك.',
    ['communication', 'compliance', 'ownership'],
  ),
  q(
    'care_small_sign',
    'Tell me about a time you noticed something small that turned out to matter.',
    'حدثني عن مرة لاحظت فيها شيئاً صغيراً تبيّن لاحقاً أنه مهم.',
    ['problem_solving', 'evidence', 'compliance'],
    'The noticing is the skill. Say what you saw, what you did, and what it prevented.',
    'الملاحظة هي المهارة. اذكر ما رأيته وما فعلته وما الذي منعته.',
  ),
  q(
    'care_handover',
    'Walk me through how you hand over at the end of a shift.',
    'اشرح لي كيف تسلّم عملك في نهاية النوبة.',
    ['communication', 'compliance', 'evidence'],
  ),
  q(
    'care_mistake_bank',
    'Tell me about a mistake in your work. What did you do next?',
    'حدثني عن خطأ في عملك. ماذا فعلت بعد ذلك؟',
    ['ownership', 'compliance', 'communication'],
    'In care work, saying it early is the professional answer. Show that.',
    'في مهن الرعاية، الإبلاغ المبكر هو التصرف المهني. أظهر ذلك.',
  ),
  q(
    'care_outside_role',
    'Tell me about a time you were asked to do something outside your role. What did you do?',
    'حدثني عن مرة طُلب منك القيام بعمل خارج نطاق دورك. ماذا فعلت؟',
    ['compliance', 'communication', 'ownership'],
  ),
];
