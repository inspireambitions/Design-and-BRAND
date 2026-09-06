'use client';

import { useLang } from './LanguageProvider';

/** Illustrative answer text, never presented as a measured customer outcome. */
export function RetryExample() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  return (
    <section className="marketing-section marketing-wrap" aria-labelledby="retry-example-title">
      <div className="marketing-section-heading">
        <p className="marketing-eyebrow">{ar ? 'مثال توضيحي خيالي' : 'Illustrative example · fictional answer'}</p>
        <h2 id="retry-example-title">{ar ? 'شاهد كيف تجعل التفاصيل إجابتك أوضح.' : 'See how detail makes your answer clearer.'}</h2>
        <p>{ar ? 'السؤال: حدثني عن موقف تعاملت فيه مع عميل غير راضٍ.' : 'Question: Tell me about a time you handled an unhappy customer.'}</p>
      </div>
      <div className="retry-example-grid">
        <article className="evidence-answer">
          <span>{ar ? 'المحاولة الأولى' : 'First answer'}</span>
          <p>{ar ? 'كان نزيل منزعجاً لأن غرفته لم تكن جاهزة. ساعدته وشكرني.' : 'A guest was upset because their room was not ready. I helped them and they thanked me.'}</p>
          <div className="evidence-improve">
            <span>{ar ? 'ما تضيفه' : 'What to add'}</span>
            <p>{ar ? 'اشرح ما فعلته أنت، ومدة الانتظار، وكيف انتهى الموقف.' : 'Explain what you did, how long it took and how it ended.'}</p>
          </div>
        </article>
        <article className="evidence-answer">
          <span>{ar ? 'بعد المحاولة مجدداً' : 'After a retry'}</span>
          <p>{ar ? <>كان نزيل منزعجاً لأن غرفته لم تكن جاهزة. <mark>راجعت الحجز ووفرت له مكاناً هادئاً للانتظار وأخبرته بالمستجدات كل عشر دقائق. أصبحت الغرفة جاهزة خلال عشرين دقيقة وشكرني على إبقائه على اطلاع.</mark></> : <>A guest was upset because their room was not ready. <mark>I checked the booking, found a quiet waiting area and updated them every ten minutes. The room was ready in twenty minutes. They thanked me for keeping them informed.</mark></>}</p>
          <div className="evidence-result">
            <span>{ar ? 'ما تغيّر' : 'What changed'}</span>
            <p>{ar ? 'توضح الإجابة الآن ما فعلته، والوقت الذي استغرقه الحل، والنتيجة.' : 'The answer now includes your actions, the time taken and the result.'}</p>
          </div>
        </article>
      </div>
      <p className="tiny retry-example-note">{ar ? 'استخدم تفاصيل تجربتك الحقيقية فقط. هذا المثال ليس نتيجة مرشح أو وعداً بدرجة.' : 'Only add details that are true to your experience. This example is not a candidate result or a promised score.'}</p>
    </section>
  );
}
