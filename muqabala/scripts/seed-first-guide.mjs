import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const file = resolve(import.meta.dirname, '../.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'rnjajs8i';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_WRITE_TOKEN;
const apiVersion = '2026-08-28';

if (!token) {
  console.error('Missing SANITY_API_WRITE_TOKEN. Add it to .env.local (never commit it).');
  process.exit(1);
}

function block(key, text, style = 'normal') {
  return {
    _type: 'block',
    _key: key,
    style,
    markDefs: [],
    children: [{ _type: 'span', _key: `${key}-s`, text, marks: [] }],
  };
}

function heading(key, text) {
  return block(key, text, 'h2');
}

function listItems(prefix, items, listItem = 'bullet') {
  return items.map((text, index) => ({
    _type: 'block',
    _key: `${prefix}-${index}`,
    style: 'normal',
    listItem,
    level: 1,
    markDefs: [],
    children: [{ _type: 'span', _key: `${prefix}-${index}-s`, text, marks: [] }],
  }));
}

const englishBody = [
  heading('en-h-want', 'What this question is for'),
  block(
    'en-p-want',
    'In a Dubai hotel, “Tell me about yourself” is not your life story. The hiring manager wants to know if you can greet guests, stay calm, and do the work on a busy desk.',
  ),
  heading('en-h-shape', 'A simple 45-second shape'),
  ...listItems('en-shape', [
    'Who you are now: your job and how long you have done it.',
    'What you actually do: check-in, guest requests, the phone, busy arrivals. Pick two.',
    'One short proof: a guest, a rush, a result.',
    'Why this hotel or this city — one sentence.',
  ], 'number'),
  heading('en-h-example', 'Example'),
  block(
    'en-p-example',
    '“I have three years in hotel front office, last at a four-star hotel. I handle check-in, guest requests and busy arrivals. Last Ramadan a group of 40 arrived late; I split the queue, prepared keys in advance and kept waiting guests updated. I want to do that work in Dubai, where the desk is faster and more international.”',
  ),
  heading('en-h-skip', 'Leave out'),
  ...listItems('en-skip', [
    'Childhood, university grades, or a long CV recap.',
    '“I am a passionate people person” with no example.',
    'Salary, visa, or overtime in the opener.',
  ]),
  heading('en-h-practise', 'Practise it out loud'),
  block(
    'en-p-practise',
    'Say it in English, then in Arabic if the job needs both. Time yourself. If you go past one minute, cut. No employer can see that practice.',
  ),
];

const arabicBody = [
  heading('ar-h-want', 'لماذا يُطرح هذا السؤال'),
  block(
    'ar-p-want',
    'في فندق بدبي، «عرّفني عن نفسك» ليس قصة حياتك. يريد مدير التوظيف أن يعرف إن كنت تستطيع استقبال الضيوف، والهدوء تحت الضغط، والعمل على مكتب استقبال مزدحم.',
  ),
  heading('ar-h-shape', 'شكل بسيط في 45 ثانية'),
  ...listItems('ar-shape', [
    'من أنت الآن: وظيفتك وكم مضى عليك فيها.',
    'ماذا تفعل فعلاً: تسجيل الوصول، طلبات الضيوف، الهاتف، أوقات الذروة. اختر اثنين.',
    'دليل قصير واحد: ضيف، زحمة، نتيجة.',
    'لماذا هذا الفندق أو هذه المدينة — جملة واحدة.',
  ], 'number'),
  heading('ar-h-example', 'مثال'),
  block(
    'ar-p-example',
    '«لدي ثلاث سنوات في استقبال الفنادق، آخرها في فندق أربع نجوم. أتولى تسجيل الوصول وطلبات الضيوف وأوقات الوصول المزدحمة. في رمضان الماضي وصل فوج من أربعين شخصاً متأخراً؛ قسّمت الطابور وجهّزت المفاتيح مسبقاً وأبقيت الضيوف على اطلاع. أريد أن أعمل بهذا المستوى في دبي، حيث المكتب أسرع وأكثر عالمية.»',
  ),
  heading('ar-h-skip', 'ما الذي تتركه'),
  ...listItems('ar-skip', [
    'الطفولة، درجات الجامعة، أو سرد طويل للسيرة.',
    '«أنا شخص اجتماعي» من دون مثال.',
    'الراتب أو التأشيرة أو العمل الإضافي في الافتتاح.',
  ]),
  heading('ar-h-practise', 'تدرب بصوت عالٍ'),
  block(
    'ar-p-practise',
    'قلها بالإنجليزية، ثم بالعربية إذا كانت الوظيفة تحتاج الاثنتين. قِس الوقت. إذا تجاوزت دقيقة، اختصر. لا يرى صاحب العمل ذلك التدريب.',
  ),
];

const document = {
  _id: 'guide-tell-me-about-yourself-dubai-front-office',
  _type: 'guide',
  title: 'How to answer “Tell me about yourself” for a Dubai front office job',
  titleAr: 'كيف تجيب على «عرّفني عن نفسك» لوظيفة استقبال في دبي',
  slug: { _type: 'slug', current: 'tell-me-about-yourself-dubai-front-office' },
  excerpt:
    'A 45-second answer for Dubai hotel reception. Then practise. No employer can see that practice.',
  excerptAr:
    'إجابة في 45 ثانية لوظيفة استقبال في فندق بدبي. ثم تدرب. لا يرى صاحب العمل ذلك التدريب.',
  body: englishBody,
  bodyAr: arabicBody,
  practiceHref: '/practice/front-office-agent',
};

const response = await fetch(
  `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}?returnIds=true`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mutations: [{ createOrReplace: document }],
    }),
  },
);

const payload = await response.json();
if (!response.ok) {
  console.error('Sanity mutate failed', response.status);
  process.exit(1);
}

const id = payload?.results?.[0]?.id || document._id;
console.log(`Seeded guide ${id} in ${projectId}/${dataset}`);
