import type { ModelAnswer, Question } from '@/lib/roles/shared';

/**
 * Editorial model answers, written in advance for the practice flow. Nothing
 * here is generated live. Each answer is first person, specific to Gulf
 * hospitality, and between 80 and 120 words across its four parts.
 *
 * Loaded on demand with the model answer view, so the text never ships in the
 * first-load bundle of the practice page.
 */
type Localised = { en: ModelAnswer; ar: ModelAnswer };

const MODEL_ANSWERS: Record<string, Record<string, Localised>> = {
  'front-office-agent': {
    intro: {
      en: {
        relevance: 'I have worked two years on hotel reception, most recently at a 180 room business hotel in Manila, and I am applying because your front desk is the first face guests meet.',
        evidence: 'On a typical shift I checked in around 60 guests, handled group arrivals for airline crews and kept our check-in time under four minutes.',
        structure: 'I started as a night auditor, moved to the day desk within a year, and was trusted to train two new colleagues.',
        clarity: 'I am calm under pressure, I speak clearly with guests from many countries, and I want to grow with a Gulf hotel that takes service seriously.',
      },
      ar: {
        relevance: 'عملت سنتين في استقبال الفنادق، وآخرها فندق أعمال يضم ١٨٠ غرفة في مانيلا، وأتقدم لهذه الوظيفة لأن مكتب الاستقبال هو أول وجه يقابله النزيل عند وصوله.',
        evidence: 'في الوردية العادية كنت أسجل وصول نحو ٦٠ نزيلاً، وأتعامل مع وصول مجموعات أطقم الطيران، وأحافظ على مدة تسجيل الوصول أقل من أربع دقائق لكل نزيل.',
        structure: 'بدأت كمراجع حسابات ليلي، ثم انتقلت إلى مكتب النهار خلال سنة واحدة، وبعدها وثق بي المدير لتدريب زميلين جديدين على النظام والإجراءات.',
        clarity: 'أنا هادئ تحت الضغط، وأتحدث بوضوح مع نزلاء من دول كثيرة، وأريد أن أنمو مع فندق خليجي يأخذ الخدمة بجدية حقيقية.',
      },
    },
    angry_guest: {
      en: {
        relevance: 'A guest arrived at midnight and found his room had been given away. He raised his voice at the desk, so I stepped out from behind it and listened without interrupting.',
        evidence: 'I apologised, upgraded him to a junior suite at the same rate, sent a fruit plate and gave him my name and shift hours.',
        structure: 'First I calmed the situation, then I fixed the room, then I followed up the next morning to check he had slept well.',
        clarity: 'He stayed three more nights and later wrote a positive review naming me, which my manager shared with the team.',
      },
      ar: {
        relevance: 'وصل نزيل عند منتصف الليل ووجد أن غرفته أُعطيت لشخص آخر، فرفع صوته عند المكتب، فخرجت من خلف المكتب ووقفت بجانبه واستمعت له دون أن أقاطعه.',
        evidence: 'اعتذرت له، ورفعت درجة غرفته إلى جناح صغير بالسعر نفسه، وأرسلت له طبق فاكهة إلى الغرفة، وأعطيته اسمي وساعات ورديتي ليتصل بي مباشرة.',
        structure: 'أولاً هدّأت الموقف، ثم حللت مشكلة الغرفة، ثم تابعت معه في صباح اليوم التالي لأتأكد أنه نام جيداً وأن كل شيء في الغرفة يعمل.',
        clarity: 'بقي معنا ثلاث ليالٍ إضافية، وكتب لاحقاً تقييماً إيجابياً ذكر فيه اسمي، وشاركه مديري مع الفريق كله في اجتماع الصباح.',
      },
    },
    overbooking: {
      en: {
        relevance: 'At 11pm a tired guest cannot wait, so my first job is to give them somewhere comfortable and a clear time.',
        evidence: 'I would check Opera for any clean room in a similar category, offer a complimentary drink in the lobby and give housekeeping a 20 minute deadline.',
        structure: 'If no room is ready in 20 minutes I would upgrade, and if the hotel is full I would call the duty manager to arrange a sister hotel and a taxi.',
        clarity: 'I would decide the drink and the upgrade myself, and escalate only the move to another hotel, keeping the guest informed every few minutes.',
      },
      ar: {
        relevance: 'في الساعة ١١ مساءً يكون النزيل متعباً ولا يستطيع الانتظار طويلاً، لذلك مهمتي الأولى أن أمنحه مكاناً مريحاً ووقتاً واضحاً ينتظر فيه.',
        evidence: 'أبحث في نظام أوبرا عن أي غرفة نظيفة من فئة مشابهة، وأقدم له مشروباً مجانياً في البهو، وأعطي قسم التدبير الفندقي مهلة ٢٠ دقيقة لتجهيز الغرفة.',
        structure: 'إذا لم تجهز غرفة خلال ٢٠ دقيقة أرفع درجة الغرفة، وإذا كان الفندق ممتلئاً أتصل بالمدير المناوب لترتيب غرفة في فندق شقيق وسيارة أجرة على حسابنا.',
        clarity: 'أقرر المشروب ورفع الدرجة بنفسي، ولا أصعّد إلا الانتقال إلى فندق آخر، وأبقي النزيل على علم بما يحدث كل بضع دقائق.',
      },
    },
    systems: {
      en: {
        relevance: 'I have used Opera PMS for two years and Protel for six months during a hotel changeover.',
        evidence: 'In Opera I did check-in and check-out, room moves, posting charges, splitting folios for corporate guests and running the night audit report.',
        structure: 'Each morning I printed the arrivals list, pre-assigned rooms for VIPs and loyalty members, then cleared any billing queries before the evening rush.',
        clarity: 'I also used Excel for the shift handover sheet and a basic CRM for guest preferences, and I learn a new system quickly with a short shadowing period.',
      },
      ar: {
        relevance: 'استخدمت نظام أوبرا لإدارة الفندق لمدة سنتين، ونظام بروتيل لستة أشهر أثناء انتقال الفندق من نظام إلى آخر.',
        evidence: 'في أوبرا كنت أسجل الوصول والمغادرة، وأنقل النزلاء بين الغرف، وأسجل الرسوم، وأقسم الفواتير لنزلاء الشركات، وأشغّل تقرير المراجعة الليلية في نهاية اليوم.',
        structure: 'كل صباح كنت أطبع قائمة الوصول، وأخصص الغرف مسبقاً لكبار الشخصيات وأعضاء برنامج الولاء، ثم أحل أي استفسارات على الفواتير قبل ازدحام المساء.',
        clarity: 'استخدمت أيضاً إكسل لورقة تسليم الوردية ونظاماً بسيطاً لتفضيلات النزلاء، وأتعلم أي نظام جديد بسرعة بعد فترة قصيرة من مرافقة زميل متمرس.',
      },
    },
    why_gulf: {
      en: {
        relevance: 'I want to work in the Gulf because its hotels serve guests from every continent at a very high standard, and that is the level I want to reach.',
        evidence: 'I have read about Dubai\'s plans for 40 million visitors and about Saudi hotels opening for the Red Sea and Riyadh Expo, so demand for trained reception staff is real.',
        structure: 'I know shifts can be long, summers are hot and the team will include twenty nationalities, so I have prepared by working split shifts and learning basic Arabic greetings.',
        clarity: 'I am ready for the pace, I respect local customs, and I want to build a career here rather than just a contract.',
      },
      ar: {
        relevance: 'أريد العمل في الخليج لأن فنادقه تخدم نزلاء من كل القارات بمستوى عالٍ جداً، وهذا هو المستوى الذي أريد أن أصل إليه في مهنتي.',
        evidence: 'قرأت عن خطة دبي لاستقبال ٤٠ مليون زائر، وعن الفنادق الجديدة في البحر الأحمر والرياض في السعودية، لذلك الطلب على موظفي استقبال مدرّبين حقيقي.',
        structure: 'أعرف أن الورديات قد تكون طويلة، وأن الصيف حار، وأن الفريق سيضم عشرين جنسية، لذلك تهيأت بالعمل في ورديات مقسمة وبتعلم التحيات العربية الأساسية.',
        clarity: 'أنا مستعد لسرعة العمل، وأحترم العادات المحلية، وأريد أن أبني مسيرة مهنية هنا وليس مجرد عقد واحد ثم أعود.',
      },
    },
  },
  waiter: {
    intro: {
      en: {
        relevance: 'I have three years of restaurant service, the last two at a 120 seat all day dining outlet in a Kochi hotel, and I am applying because I enjoy busy floors and guests who come back.',
        evidence: 'I usually ran a section of eight tables, carried the breakfast buffet setup and kept my average check higher than the outlet target through drinks and desserts.',
        structure: 'I began as a busser, was promoted to server after six months and was chosen to serve the VIP table at events.',
        clarity: 'I am punctual, I remember regular guests by name and I want to bring that habit to a Gulf restaurant with high standards.',
      },
      ar: {
        relevance: 'لدي ثلاث سنوات في خدمة المطاعم، آخرها سنتان في مطعم يعمل طوال اليوم ويضم ١٢٠ مقعداً داخل فندق في كوتشي، وأتقدم لهذه الوظيفة لأنني أستمتع بالصالات المزدحمة وبالضيوف الذين يعودون.',
        evidence: 'كنت أدير عادةً قسماً من ثماني طاولات، وأجهّز بوفيه الإفطار، وأحافظ على متوسط الفاتورة أعلى من هدف المطعم عبر المشروبات والحلويات.',
        structure: 'بدأت كمساعد نادل، ثم رُقّيت إلى نادل بعد ستة أشهر، ثم اختارني المدير لخدمة طاولة كبار الشخصيات في المناسبات الخاصة.',
        clarity: 'أنا ملتزم بالمواعيد، وأتذكر الضيوف الدائمين بأسمائهم، وأريد أن أنقل هذه العادة إلى مطعم خليجي يعمل بمعايير عالية.',
      },
    },
    wrong_order: {
      en: {
        relevance: 'When a guest says the dish is wrong, the mistake is ours whatever the reason, so I apologise first and take the plate away at once.',
        evidence: 'I repeat back what they ordered, tell the kitchen it is a priority, and give an honest time, usually eight to ten minutes for a main course.',
        structure: 'Once I served a chicken biryani to a guest who had asked for vegetable, I removed it within a minute, brought bread and a drink on the house, and checked with the chef myself.',
        clarity: 'The right dish arrived in nine minutes, I told my supervisor, and the guest left a good tip and thanked me by name.',
      },
      ar: {
        relevance: 'عندما يقول الضيف إن طلبه خاطئ فالخطأ خطؤنا مهما كان السبب، لذلك أعتذر أولاً وأرفع الطبق من الطاولة فوراً.',
        evidence: 'أكرر له ما طلبه للتأكد، وأخبر المطبخ أن الطلب أولوية، وأعطيه وقتاً صادقاً، وهو عادةً بين ثماني وعشر دقائق للطبق الرئيسي.',
        structure: 'ذات مرة قدمت برياني دجاج لضيف طلب برياني خضار، فرفعت الطبق خلال دقيقة، وأحضرت له خبزاً ومشروباً على حساب المطعم، وتابعت مع الشيف بنفسي.',
        clarity: 'وصل الطبق الصحيح خلال تسع دقائق، وأبلغت مشرفي بما حدث حتى لا يتكرر، وترك الضيف إكرامية جيدة وشكرني باسمي عند خروجه من المطعم.',
      },
    },
    upselling: {
      en: {
        relevance: 'A good recommendation helps the guest enjoy the meal, so I listen first and suggest something that fits what they already like.',
        evidence: 'A family celebrating a birthday ordered grilled hammour, so I suggested the saffron rice as a side and our date pudding with a candle for dessert.',
        structure: 'I described both dishes in one sentence each, they agreed, and the bill rose by about 90 dirhams, roughly 30 percent.',
        clarity: 'The father booked again for the following Friday and asked for my section, which my manager noted in our guest history.',
      },
      ar: {
        relevance: 'الاقتراح الجيد يساعد الضيف على الاستمتاع بوجبته أكثر ويرفع قيمة الفاتورة في الوقت نفسه، لذلك أستمع أولاً ثم أقترح شيئاً يناسب ما اختاره بالفعل.',
        evidence: 'عائلة تحتفل بعيد ميلاد طلبت سمك الهامور المشوي، فاقترحت عليهم أرز الزعفران كطبق جانبي، وحلوى التمر مع شمعة صغيرة في نهاية الوجبة.',
        structure: 'وصفت كل طبق بجملة واحدة، فوافقوا، وارتفعت قيمة الفاتورة بنحو ٩٠ درهماً، أي حوالي ٣٠ في المئة من قيمتها الأصلية.',
        clarity: 'حجز الأب مرة أخرى في يوم الجمعة التالي وطلب أن يجلس في قسمي، وسجّل مديري ذلك في سجل تفضيلات الضيوف لدينا.',
      },
    },
    busy_shift: {
      en: {
        relevance: 'With six tables alone I cannot serve everyone at once, so I greet every table within two minutes and tell them exactly when I will be back.',
        evidence: 'I take drinks orders first for all six, send them together, then take food orders in the order the tables were seated.',
        structure: 'During a Ramadan iftar rush I did this for eight tables, asked the host to hold new seating for ten minutes and called the kitchen to stagger the mains.',
        clarity: 'Guests waited longer but knew why, nobody complained and my supervisor used my table order method for the rest of the month.',
      },
      ar: {
        relevance: 'مع ست طاولات وأنا وحدي لا أستطيع خدمة الجميع في اللحظة نفسها، لذلك أرحب بكل طاولة خلال دقيقتين وأخبرهم بالضبط متى سأعود إليهم.',
        evidence: 'آخذ طلبات المشروبات أولاً من الطاولات الست، وأرسلها معاً إلى البار، ثم آخذ طلبات الطعام حسب ترتيب جلوس الطاولات حتى لا ينتظر أحد أكثر من غيره.',
        structure: 'في ازدحام إفطار رمضان فعلت ذلك مع ثماني طاولات، وطلبت من المضيف تأجيل إجلاس ضيوف جدد عشر دقائق، واتصلت بالمطبخ لتوزيع خروج الأطباق الرئيسية.',
        clarity: 'انتظر الضيوف وقتاً أطول لكنهم عرفوا السبب، ولم يشتكِ أحد، واعتمد مشرفي طريقتي في ترتيب الطاولات لبقية الشهر.',
      },
    },
    why_gulf: {
      en: {
        relevance: 'I want to work in the Gulf because its restaurants serve many nationalities at a pace and standard that will make me a better waiter.',
        evidence: 'I know that Dubai has more than 13,000 restaurants, that Friday brunch and Ramadan iftar are peak times, and that alcohol service needs a licence and care.',
        structure: 'I have prepared by learning Arabic greetings, reading about halal standards and asking two friends in Doha about split shifts and shared housing.',
        clarity: 'I expect long days in summer heat and a strict grooming standard, and I am ready because I want a long career here, not just a first contract.',
      },
      ar: {
        relevance: 'أريد العمل في الخليج لأن مطاعمه تخدم جنسيات كثيرة بسرعة ومعايير عالية ستجعلني نادلاً أفضل مما أنا عليه اليوم، وهذا ما أبحث عنه.',
        evidence: 'أعرف أن في دبي أكثر من ١٣ ألف مطعم، وأن غداء الجمعة وإفطار رمضان هما وقتا الذروة، وأن تقديم المشروبات الكحولية يحتاج إلى ترخيص وحذر.',
        structure: 'تهيأت بتعلم التحيات العربية، وبالقراءة عن معايير الحلال، وبسؤال صديقين يعملان في الدوحة عن الورديات المقسمة والسكن المشترك.',
        clarity: 'أتوقع أياماً طويلة في حر الصيف ومعايير صارمة للمظهر، وأنا مستعد لذلك لأنني أريد مسيرة مهنية طويلة هنا، وليس عقداً أول فقط.',
      },
    },
  },
};

/**
 * The model answer for a question in the interview language. A question's own
 * `modelAnswer` fields win; the editorial catalogue above is the fallback.
 * Returns null when there is nothing to show, so the control is not rendered.
 */
export function modelAnswerFor(
  roleId: string,
  question: Pick<Question, 'id' | 'modelAnswer' | 'modelAnswerAr'>,
  lang: 'en' | 'ar',
): ModelAnswer | null {
  if (lang === 'ar' && question.modelAnswerAr) return question.modelAnswerAr;
  if (question.modelAnswer) return question.modelAnswer;
  const localised = MODEL_ANSWERS[roleId]?.[question.id];
  return localised ? localised[lang] : null;
}
