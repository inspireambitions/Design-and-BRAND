import type { Lang } from './i18n';

export type MarketingSection = {
  title: string;
  body: string;
  points?: string[];
  href?: string;
  linkLabel?: string;
};

export type MarketingRole = {
  id: string;
  industry: string;
  industryAr: string;
  title: string;
  titleAr: string;
  blurb: string;
  blurbAr: string;
  questionCount: number;
};

export type MarketingPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: MarketingSection[];
};

type Localised<T> = Record<Lang, T>;

export const marketingNav: Localised<Record<string, string>> = {
  en: {
    how: 'How it works',
    roles: 'Interview roles',
    feedback: 'Your feedback',
    about: 'About',
    faq: 'FAQ',
    blog: 'Guides',
    practice: 'Start practising free',
    progress: 'My progress',
  },
  ar: {
    how: 'كيف يعمل',
    roles: 'وظائف المقابلات',
    feedback: 'ملاحظاتك',
    about: 'من نحن',
    faq: 'الأسئلة الشائعة',
    blog: 'الأدلة',
    practice: 'ابدأ التدريب مجاناً',
    progress: 'تقدمي',
  },
};

export const homeCopy: Localised<Record<string, string>> = {
  en: {
    eyebrow: 'Private practice for Gulf job interviews',
    title: 'Practise for your Gulf job interview.',
    intro:
      'Choose your job. Answer in English or Arabic. Muqabala shows what you did well, what is missing and what to add next.',
    primary: 'Start practising free',
    secondary: 'See an example',
    trust: 'Free. No sign-up. We never score your face, accent or personality.',
    questionLabel: 'Practice question',
    question: 'Tell me about a time you handled an unhappy customer.',
    answerLabel: 'Your answer',
    answerBefore: 'A guest was upset because their room was not ready. ',
    answerEvidence: 'I checked the booking, found a quiet waiting area and updated them every ten minutes.',
    answerAfter: ' They thanked me when the room was ready.',
    evidenceLabel: 'What you did well',
    evidenceTitle: 'You said what you did',
    evidenceBody: 'You explained your action. You also said how you kept the guest informed.',
    improveLabel: 'Add this next',
    improveBody: 'Say how fast you solved the problem. Then explain how the guest felt at the end.',
    jobTitle: 'Do you have a job advert?',
    jobBody: 'Paste it here. Muqabala will build a full interview for that job.',
    jobCta: 'Use my job advert',
    stepsTitle: 'Three simple steps',
    step1Title: '1. Pick a job',
    step1Body: 'Choose a job from the list. You can also paste a job advert.',
    step2Title: '2. Give your answer',
    step2Body: 'Speak or type. Check the words before you ask for feedback.',
    step3Title: '3. Read your feedback',
    step3Body: 'See what worked. See what to add. Then try the question again.',
    proofTitle: 'Proof, not performance.',
    methodEyebrow: 'Muqabala method',
    proofBody:
      'Muqabala uses the words in your answer. It does not judge your face, accent or personality.',
    neverTitle: 'We score your answer. We do not score you.',
    trustEyebrow: 'Candidate trust',
    never1: 'No facial analysis',
    never2: 'No emotion detection',
    never3: 'No accent scoring',
    never4: 'No personality assumptions',
    never5: 'We do not decide who gets hired',
    never6: 'No employer access to practice recordings',
    privacyTitle: 'Your practice is private',
    privacyBody:
      'Your video stays on your device. You can type instead of speaking. You can also fix the written words before you get feedback.',
    privacyDetail:
      'We send the text of your answer to our feedback service. Before you verify your email, we temporarily save your progress for up to seven days. Reports you choose to keep are saved privately in your account.',
    rolesTitle: 'Practise for the job you want',
    rolesBody: 'Start with a popular Gulf role or browse the full directory.',
    allRoles: 'Browse all interview roles',
    finalTitle: 'Your next answer can be stronger.',
    finalBody: 'Practise in private. Read your feedback. Try again when you are ready.',
  },
  ar: {
    eyebrow: 'تدريب خاص لمقابلات العمل في الخليج',
    title: 'تدرّب على مقابلة عملك في الخليج.',
    intro:
      'اختر الوظيفة. أجب بالعربية أو الإنجليزية. يوضح لك مقابلة ما فعلته جيداً وما ينقص إجابتك وما تضيفه بعد ذلك.',
    primary: 'ابدأ التدريب مجاناً',
    secondary: 'شاهد مثالاً',
    trust: 'مجاني وبدون تسجيل. لا نقيّم وجهك أو لهجتك أو شخصيتك.',
    questionLabel: 'سؤال تدريبي',
    question: 'حدثني عن موقف تعاملت فيه مع عميل غير راضٍ.',
    answerLabel: 'إجابتك',
    answerBefore: 'كان أحد النزلاء منزعجاً لأن غرفته لم تكن جاهزة. ',
    answerEvidence: 'راجعت الحجز ووفرت له مكاناً هادئاً للانتظار وأطلعته على المستجدات كل عشر دقائق.',
    answerAfter: ' شكرني عندما أصبحت الغرفة جاهزة.',
    evidenceLabel: 'ما فعلته جيداً',
    evidenceTitle: 'ذكرت ما فعلته',
    evidenceBody: 'شرحت ما فعلته وكيف أخبرت النزيل بما يحدث.',
    improveLabel: 'أضف هذا بعد ذلك',
    improveBody: 'اذكر سرعة حل المشكلة وكيف شعر النزيل في النهاية.',
    jobTitle: 'هل لديك إعلان وظيفة؟',
    jobBody: 'الصقه هنا. سيبني مقابلة كاملة لهذه الوظيفة.',
    jobCta: 'استخدم إعلان الوظيفة',
    stepsTitle: 'ثلاث خطوات سهلة',
    step1Title: '١. اختر وظيفة',
    step1Body: 'اختر وظيفة من القائمة أو الصق إعلان الوظيفة.',
    step2Title: '٢. أعط إجابتك',
    step2Body: 'تحدث أو اكتب. راجع الكلمات قبل طلب الملاحظات.',
    step3Title: '٣. اقرأ ملاحظاتك',
    step3Body: 'شاهد ما نجح وما يجب إضافته. ثم حاول مرة أخرى.',
    proofTitle: 'الدليل، لا المظهر.',
    methodEyebrow: 'منهج مقابلة',
    proofBody:
      'يستخدم مقابلة كلمات إجابتك. لا يحكم على وجهك أو لهجتك أو شخصيتك.',
    neverTitle: 'نقيّم إجابتك. لا نقيّمك أنت.',
    trustEyebrow: 'ثقة المرشح',
    never1: 'لا تحليل للوجه',
    never2: 'لا كشف للمشاعر',
    never3: 'لا تقييم للهجة',
    never4: 'لا افتراضات عن الشخصية',
    never5: 'لا قرارات توظيف آلية',
    never6: 'لا وصول لصاحب العمل إلى تسجيلات التدريب',
    privacyTitle: 'تدريبك خاص',
    privacyBody:
      'يبقى الفيديو على جهازك. يمكنك الكتابة بدلاً من التحدث. ويمكنك تعديل الكلمات قبل الحصول على الملاحظات.',
    privacyDetail:
      'نرسل نص إجابتك إلى خدمة التقييم. قبل تأكيد بريدك الإلكتروني، نحفظ تقدمك مؤقتاً لمدة تصل إلى سبعة أيام. التقارير التي تختار الاحتفاظ بها تُحفظ بشكل خاص في حسابك.',
    rolesTitle: 'تدرّب للوظيفة التي تريدها',
    rolesBody: 'ابدأ بوظيفة خليجية شائعة أو تصفح الدليل الكامل.',
    allRoles: 'تصفح جميع وظائف المقابلات',
    finalTitle: 'يمكن أن تكون إجابتك التالية أقوى.',
    finalBody: 'تدرّب بخصوصية وراجع الدليل ثم حاول مرة أخرى عندما تكون جاهزاً.',
  },
};

export const infoPages: Record<string, Localised<MarketingPageContent>> = {
  'how-it-works': {
    en: {
      eyebrow: 'How it works',
      title: 'Practise in five easy steps.',
      intro: 'This is private practice. Take your time. No employer can see your answers.',
      sections: [
        { title: '1. Choose a job', body: 'Pick a job from the list. You can also type a job title or paste a job advert.' },
        { title: '2. Speak or type', body: 'Use your camera for real practice. You can also type. Both choices give you the same feedback.' },
        { title: '3. Check the words', body: 'If you spoke, read the written words. Fix any mistake before you ask for feedback.' },
        { title: '4. Read your feedback', body: 'See what you did well. Then see one clear way to make your answer better.' },
        { title: '5. Try again', body: 'Repeat the question as many times as you need. We autosave your progress. Verify your email to continue on another device.' },
      ],
    },
    ar: {
      eyebrow: 'كيف يعمل',
      title: 'تدرّب في خمس خطوات سهلة.',
      intro: 'هذا تدريب خاص. خذ وقتك. لا يرى صاحب العمل إجاباتك.',
      sections: [
        { title: '١. اختر وظيفة', body: 'اختر وظيفة من القائمة. يمكنك أيضاً كتابة المسمى أو لصق إعلان الوظيفة.' },
        { title: '٢. تحدث أو اكتب', body: 'استخدم الكاميرا للتدريب الواقعي أو اكتب. ستحصل على نفس الملاحظات.' },
        { title: '٣. راجع الكلمات', body: 'إذا تحدثت، اقرأ النص وصحح أي خطأ قبل طلب الملاحظات.' },
        { title: '٤. اقرأ ملاحظاتك', body: 'شاهد ما فعلته جيداً وطريقة واحدة واضحة لتحسين إجابتك.' },
        { title: '٥. حاول مرة أخرى', body: 'أعد السؤال بقدر ما تحتاج. يبقى تقدمك في هذا المتصفح.' },
      ],
    },
  },
  'how-feedback-works': {
    en: {
      eyebrow: 'Your feedback',
      title: 'We show why you got your score.',
      intro: 'Muqabala reads the words in your answer. It shows what worked and what you can add next.',
      sections: [
        { title: 'What we look for', body: 'We look for a real example. We check what you did, why you did it and what happened at the end.' },
        { title: 'What we never score', body: 'We do not score your face, looks, eye contact, feelings, accent, grammar or personality.' },
        { title: 'We show the proof', body: 'Your feedback points to words from your answer. If something is missing, we tell you. We do not make it up.' },
        { title: 'Sometimes there is no score', body: 'We may not score an answer if the words are too short or unclear. This helps protect you from a wrong score.' },
        { title: 'Check the feedback', body: 'AI can make mistakes. Read the feedback and decide what is useful. Muqabala does not make hiring decisions.' },
      ],
    },
    ar: {
      eyebrow: 'ملاحظاتك',
      title: 'نوضح سبب درجتك.',
      intro: 'يقرأ مقابلة كلمات إجابتك. يوضح ما نجح وما يمكنك إضافته بعد ذلك.',
      sections: [
        { title: 'ما الذي نبحث عنه', body: 'نبحث عن مثال حقيقي وما فعلته ولماذا فعلته وما حدث في النهاية.' },
        { title: 'ما الذي لا نقيّمه', body: 'لا نقيّم وجهك أو مظهرك أو نظرك أو مشاعرك أو لهجتك أو قواعد اللغة أو شخصيتك.' },
        { title: 'نوضح الدليل', body: 'تشير الملاحظات إلى كلمات من إجابتك. إذا كان شيء ناقصاً، نخبرك ولا نخترعه.' },
        { title: 'أحياناً لا توجد درجة', body: 'قد لا نقيّم الإجابة إذا كانت قصيرة أو غير واضحة. هذا يحميك من درجة خاطئة.' },
        { title: 'راجع الملاحظات', body: 'قد يخطئ الذكاء الاصطناعي. اقرأ الملاحظات واستخدم حكمك. لا يتخذ مقابلة قرار التوظيف.' },
      ],
    },
  },
  about: {
    en: {
      eyebrow: 'Built for candidates',
      title: 'Interview practice should help, not scare you.',
      intro: 'Muqabala helps people prepare for jobs in the Gulf. You can use it from any country.',
      sections: [
        { title: 'Why we built it', body: 'Many good workers find interviews hard. Private practice helps you explain your real experience clearly.' },
        { title: 'Made for Gulf jobs', body: 'The practice covers jobs in the UAE, Saudi Arabia, Qatar, Oman, Bahrain and Kuwait.' },
        { title: 'People still make hiring decisions', body: 'Muqabala only helps you practise. It does not choose who gets hired. It cannot promise you a job.' },
        { title: 'Built with HR experience', body: 'An HR Career Specialist with more than 20 years of Gulf and African experience leads this project through Inspire Ambitions.' },
      ],
    },
    ar: {
      eyebrow: 'مصمم للمرشحين',
      title: 'يجب أن يبني تدريب المقابلات الثقة، لا الخوف.',
      intro: 'مقابلة مشروع من إنسباير أمبيشنز للأشخاص المتقدمين لوظائف خليجية من المنطقة ومن أنحاء العالم.',
      sections: [
        { title: 'لماذا وُجد مقابلة', body: 'قد يجد المرشح الجيد صعوبة في شرح خبرته تحت الضغط. يساعد التدريب الخاص والمتكرر على تحويل العمل الحقيقي إلى دليل واضح.' },
        { title: 'خبرة الخليج في المركز', body: 'يعكس المنتج الوظائف وظروف العمل والتوقعات في الإمارات والسعودية وقطر وعمان والبحرين والكويت.' },
        { title: 'الحكم البشري مهم', body: 'يدعم مقابلة الاستعداد ولا يقرر من يجب توظيفه ولا يضمن عرض عمل.' },
        { title: 'موجّه بخبرة الموارد البشرية', body: 'يقود المشروع عبر إنسباير أمبيشنز أخصائي مسار مهني في الموارد البشرية بخبرة تتجاوز 20 عاماً في الخليج وأفريقيا.' },
      ],
    },
  },
  privacy: {
    en: {
      eyebrow: 'Privacy in plain language',
      title: 'Know what happens to your information.',
      intro: 'We explain this before you start. You can type if you do not want to use your camera or microphone.',
      sections: [
        { title: 'Video', body: 'Your video is used for your own practice preview. It is never uploaded or saved by Muqabala.' },
        { title: 'Your voice', body: 'Your browser may send your voice to its own speech service to turn it into text. Choose typing if you do not want this.' },
        { title: 'Your written answer', body: 'We send your written answer to our AI service for feedback. If you paste a job advert, we send its text and job title to make your questions.' },
        { title: 'Your practice history', body: 'We autosave unfinished progress. Before email verification, temporary records expire after seven days. After verification, reports you choose to keep stay private in your account until you delete them.' },
        { title: 'Account emails', body: 'After you verify a new account, we send one useful onboarding email. Career tips, product updates and other Inspire Ambitions tools are optional. You receive them only if you choose email updates in your account, and you can unsubscribe at any time.' },
        { title: 'Report sharing', body: 'A WhatsApp share creates a private link that expires after seven days. The link can be revoked. Anyone who has an active link can read that report.' },
        { title: 'Basic website data', body: 'We may collect data without your name about website use and errors. We do not include your video, voice, answers or job advert.' },
      ],
    },
    ar: {
      eyebrow: 'الخصوصية بلغة واضحة',
      title: 'اعرف ما يبقى وما يتم إرساله.',
      intro: 'يشرح مقابلة استخدام البيانات قبل بدء التدريب ويمكنك الكتابة بدلاً من استخدام الكاميرا أو الميكروفون.',
      sections: [
        { title: 'الفيديو', body: 'يُستخدم الفيديو لمعاينة تدريبك فقط ولا يرفعه مقابلة أو يحفظه.' },
        { title: 'الصوت والتعرف على الكلام', body: 'عندما لا يكون التعرف على الكلام مؤكداً داخل الجهاز، قد يرسل المتصفح الصوت إلى خدمة الكلام الخاصة به. استخدم الكتابة إذا كنت لا تريد ذلك.' },
        { title: 'النص وإعلان الوظيفة', body: 'يُرسل نص إجابتك إلى مسار التقييم ثم إلى مزود الذكاء الاصطناعي. يُرسل إعلان الوظيفة والمسمى لإنشاء أسئلة مخصصة.' },
        { title: 'سجل التدريب', body: 'نحفظ التقدم غير المكتمل تلقائياً. تنتهي السجلات المؤقتة بعد سبعة أيام قبل تأكيد البريد. بعد التأكيد، تبقى التقارير التي تختارها خاصة في حسابك حتى تحذفها.' },
        { title: 'رسائل الحساب', body: 'بعد تأكيد حساب جديد، نرسل رسالة تعريف مفيدة واحدة. نصائح المسار المهني وتحديثات المنتج وأدوات إنسباير أمبيشنز الأخرى اختيارية. لا تصلك إلا إذا اخترت ذلك بشكل منفصل، ويمكنك إلغاء الاشتراك في أي وقت.' },
        { title: 'مشاركة التقرير', body: 'تنشئ المشاركة عبر واتساب رابطاً خاصاً ينتهي بعد سبعة أيام ويمكن إلغاؤه. أي شخص لديه رابط نشط يمكنه قراءة التقرير.' },
        { title: 'التحليلات والأخطاء التقنية', body: 'قد يجمع مقابلة أحداث استخدام مجهولة وعلامات أعطال تقنية دون فيديو أو صوت أو نصوص أو كلمات إعلان الوظيفة.' },
      ],
    },
  },
  terms: {
    en: {
      eyebrow: 'Terms of use',
      title: 'Muqabala is for practice only.',
      intro: 'Use the feedback to help you prepare. Check it and decide what is useful.',
      sections: [
        { title: 'Practice only', body: 'Muqabala is not an employer or recruitment agency. It cannot promise an interview or a job.' },
        { title: 'AI can be wrong', body: 'Questions, written words, feedback and scores can have mistakes. Check them before you act.' },
        { title: 'Protect private information', body: 'Only share information you have the right to use. Do not add private details about an employer, client or person.' },
        { title: 'Use the service fairly', body: 'Do not attack, break or misuse the service. Do not use it to make automatic hiring decisions.' },
        { title: 'The service may change', body: 'We may improve or change features. The service may sometimes stop working for a short time.' },
      ],
    },
    ar: {
      eyebrow: 'شروط الاستخدام',
      title: 'إرشاد للتدريب، وليس قرار توظيف.',
      intro: 'باستخدام مقابلة، توافق على استخدامه للاستعداد للمقابلات وعلى تطبيق حكمك على ملاحظاته.',
      sections: [
        { title: 'للتدريب فقط', body: 'لا يمثل مقابلة صاحب عمل أو وكالة توظيف أو عرض عمل ولا يضمن مقابلة أو وظيفة أو نتيجة محددة.' },
        { title: 'حدود الذكاء الاصطناعي', body: 'قد تحتوي الأسئلة والنصوص والملاحظات والدرجات على أخطاء. راجع النص والدليل قبل الاعتماد على أي اقتراح.' },
        { title: 'محتواك', body: 'أرسل فقط إعلانات الوظائف والمحتوى الذي يحق لك استخدامه ولا تدرج معلومات سرية عن صاحب عمل أو عميل أو شخص.' },
        { title: 'الاستخدام المقبول', body: 'لا تسئ استخدام الخدمة أو تحاول تعطيلها أو هندسة الأنظمة المحمية عكسياً أو استخدامها لاتخاذ قرارات توظيف آلية.' },
        { title: 'التغييرات والتوفر', body: 'قد تتغير الميزات أثناء التطوير وقد تحدث انقطاعات مؤقتة. قد يؤدي تعطل خدمة التقييم إلى ترك الإجابة دون درجة.' },
      ],
    },
  },
  faq: {
    en: {
      eyebrow: 'Questions before you practise',
      title: 'Your questions, answered.',
      intro: 'Read these short answers before you start.',
      sections: [
        { title: 'Is Muqabala free?', body: 'Yes. Practice is free and unlimited now. We will clearly show any paid choice before you use it.' },
        { title: 'Will an employer see my recording?', body: 'No. Muqabala Coach is private candidate practice. Your video is not uploaded and there is no employer access to your practice history.' },
        { title: 'Does it score my face or accent?', body: 'No. The scoring policy excludes face, appearance, eye contact, emotion, accent, pronunciation, grammar fluency and personality.' },
        { title: 'Can I practise in Arabic?', body: 'Yes. The website and questions work in Arabic and English. If we cannot score an Arabic answer fairly, we will not give a score.' },
        { title: 'Do I need a camera?', body: 'No. You can type and receive the same content feedback. A camera can make practice feel more realistic, but it is not scored.' },
        { title: 'What if the written words are wrong?', body: 'Fix them before you ask for feedback. If the words are too unclear, Muqabala will not give a score.' },
      ],
    },
    ar: {
      eyebrow: 'أسئلة قبل التدريب',
      title: 'إجابات واضحة قبل تشغيل الكاميرا.',
      intro: 'يجب أن تعرف كيف يعمل مقابلة وما تكلفته وما يحدث لتدريبك قبل أن تبدأ.',
      sections: [
        { title: 'هل مقابلة مجاني؟', body: 'تجربة التدريب الحالية مجانية وغير محدودة. سيظهر أي خيار مدفوع مستقبلي بوضوح قبل أن يؤثر على الوصول.' },
        { title: 'هل يرى صاحب العمل تسجيلي؟', body: 'لا. مقابلة كوتش تدريب خاص للمرشح ولا يرفع الفيديو ولا يمنح صاحب العمل وصولاً إلى سجل التدريب.' },
        { title: 'هل يقيّم وجهي أو لهجتي؟', body: 'لا. تستبعد سياسة التقييم الوجه والمظهر والتواصل البصري والمشاعر واللهجة والنطق والطلاقة النحوية والشخصية.' },
        { title: 'هل يمكنني التدريب بالعربية؟', body: 'نعم عندما يتوفر تقييم الذكاء الاصطناعي. تدعم الواجهة والأسئلة العربية والإنجليزية. إذا لم يستطع مسار التقييم تقييم العربية بعدل، يرفض بدلاً من اختراع درجة.' },
        { title: 'هل أحتاج إلى كاميرا؟', body: 'لا. يمكنك الكتابة والحصول على نفس ملاحظات المحتوى. تجعل الكاميرا التدريب أكثر واقعية لكنها ليست جزءاً من التقييم.' },
        { title: 'ماذا لو كان النص خاطئاً؟', body: 'عدّله قبل التقييم. إذا كان النص غير موثوق بدرجة تمنع التقييم، يترك مقابلة الإجابة دون درجة.' },
      ],
    },
  },
  contact: {
    en: {
      eyebrow: 'Support and feedback',
      title: 'Tell us what went wrong.',
      intro: 'Your message helps us make Muqabala easier and more useful.',
      sections: [
        { title: 'Report a problem', body: 'Tell us your phone or device, browser and language. Say where the problem happened. Do not send private answer details.' },
        { title: 'Share your opinion', body: 'Tell us if the feedback was clear and useful. Tell us what would make you practise again.' },
        { title: 'Personal interview coaching', body: 'Human coaching is separate from the app and may be offered through Inspire Ambitions. It is preparation only and does not guarantee a job.' },
        { title: 'Contact us', body: 'Send your message through the Inspire Ambitions contact page.', href: 'https://inspireambitions.com/contact/', linkLabel: 'Open the contact page' },
      ],
    },
    ar: {
      eyebrow: 'الدعم والملاحظات',
      title: 'أخبرنا ما الذي جعل التدريب صعباً.',
      intro: 'تساعد ملاحظات المرشحين مقابلة على تحسين الأسئلة ودعم اللغة والموثوقية والتفسيرات.',
      sections: [
        { title: 'الإبلاغ عن مشكلة تقنية', body: 'اذكر الجهاز والمتصفح واللغة والمرحلة التي حدثت فيها المشكلة والرسالة التي رأيتها. لا ترسل محتوى سرياً.' },
        { title: 'مشاركة رأيك في المنتج', body: 'أخبرنا هل كانت الملاحظات محددة وهل وثقت بها وما الذي سيجعلك تتدرب مرة أخرى.' },
        { title: 'تدريب شخصي للمقابلات', body: 'التدريب البشري منفصل عن التطبيق وقد يتوفر عبر إنسباير أمبيشنز. هو للاستعداد فقط ولا يضمن وظيفة.' },
        { title: 'طريقة التواصل', body: 'استخدم صفحة تواصل إنسباير أمبيشنز إلى أن تصبح قناة دعم مقابلة المخصصة جاهزة.', href: 'https://inspireambitions.com/contact/', linkLabel: 'افتح صفحة التواصل' },
      ],
    },
  },
  accessibility: {
    en: {
      eyebrow: 'Access without pressure',
      title: 'Practice should be easy to use.',
      intro: 'Muqabala works on phones and with a keyboard. It supports Arabic reading from right to left.',
      sections: [
        { title: 'Camera-free practice', body: 'Typing provides the same content feedback and avoids camera and microphone permissions.' },
        { title: 'Use a keyboard', body: 'You can use the main controls without a mouse. A clear border shows which control you chose.' },
        { title: 'Clear text and less movement', body: 'We use easy-to-read colours. We also reduce movement when your device asks us to.' },
        { title: 'Tell us about a problem', body: 'If anything is hard to see, hear, understand or use, tell us your device, browser and the page.' },
      ],
    },
    ar: {
      eyebrow: 'وصول دون ضغط',
      title: 'يجب أن يعمل التدريب لعدد أكبر من الناس.',
      intro: 'يُبنى مقابلة لاستخدام لوحة المفاتيح والتباين المقروء وتقليل الحركة واتجاه العربية والأجهزة المحمولة.',
      sections: [
        { title: 'تدريب دون كاميرا', body: 'توفر الكتابة نفس ملاحظات المحتوى وتتجنب أذونات الكاميرا والميكروفون.' },
        { title: 'لوحة المفاتيح والتركيز', body: 'يجب أن تبقى عناصر التحكم قابلة للاستخدام دون فأرة وأن تظهر مؤشر تركيز واضحاً.' },
        { title: 'الحركة والتباين', body: 'تحترم التجربة تفضيلات تقليل الحركة وتهدف إلى تباين ألوان WCAG AA.' },
        { title: 'الإبلاغ عن عائق', body: 'إذا كان أي جزء صعب الرؤية أو السماع أو الفهم أو التحكم، اذكر الجهاز والمتصفح والشاشة التي حدث فيها ذلك.' },
      ],
    },
  },
};
