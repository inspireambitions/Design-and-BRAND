import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const runAi = __ENV.CONFIRM_AI_SPEND === 'YES';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '3m', target: 250 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 750 },
    { duration: '10m', target: 1000 },
    { duration: '3m', target: 1500 },
    { duration: '3m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

const questionIds = [
  'intro',
  'angry_guest',
  'overbooking',
  'systems',
  'svc_worst_day',
  'svc_mistake_bank',
  'svc_two_customers',
  'why_gulf',
];
const questions = questionIds.map((id) => ({
  id,
  text: 'Canonical question supplied by the server.',
  textAr: 'يتم توفير السؤال المعتمد من الخادم.',
  competencies: [],
  hint: '',
  hintAr: '',
  prepSeconds: 30,
  answerSeconds: 120,
}));

export default function () {
  const page = http.get(`${baseUrl}/practice/front-office-agent`);
  check(page, { 'practice page loads': (response) => response.status === 200 });
  sleep(Math.random() * 2 + 1);

  const create = http.post(`${baseUrl}/api/interviews`, JSON.stringify({
    roleId: 'front-office-agent',
    roleTitle: 'Front Office Agent',
    language: 'en',
    mode: 'mock',
    questions,
  }), { headers: { 'Content-Type': 'application/json', Origin: baseUrl } });
  check(create, { 'interview starts': (response) => response.status === 201 });
  if (create.status !== 201) return;
  const id = create.json('id');
  sleep(Math.random() * 5 + 2);

  for (let questionIndex = 0; questionIndex < questionIds.length; questionIndex += 1) {
    const answer = `Load test candidate ${exec.vu.idInTest} gives answer ${questionIndex + 1}, describes a real hotel problem, the action taken and the confirmed result.`;
    const completed = questionIndex === questionIds.length - 1;
    const save = http.patch(`${baseUrl}/api/interviews/${id}`, JSON.stringify({
      questionIndex,
      transcript: answer,
      currentQuestion: completed ? questionIndex : questionIndex + 1,
      status: completed ? 'completed' : 'in_progress',
    }), { headers: { 'Content-Type': 'application/json', Origin: baseUrl } });
    check(save, { 'answer autosaves': (response) => response.status === 200 });

    if (runAi) {
      const score = http.post(`${baseUrl}/api/score`, JSON.stringify({
        roleId: 'front-office-agent',
        questionId: questionIds[questionIndex],
        questionIndex,
        interviewId: id,
        transcript: answer,
        lang: 'en',
      }), { headers: { 'Content-Type': 'application/json', Origin: baseUrl, 'X-Scoring-Session': `${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${questionIndex}` } });
      check(score, { 'AI response is controlled': (response) => [200, 409, 429, 503].includes(response.status) });
    }
    sleep(Math.random() * 2 + 0.5);
  }

  const report = http.get(`${baseUrl}/api/interviews/${id}/report`);
  check(report, {
    'anonymous report is locked': (response) => response.status === 200 && response.json('unlocked') === false,
    'only question one is exposed': (response) => response.status === 200 && response.json('answers').length === 1,
  });
  sleep(Math.random() * 3 + 1);
}
