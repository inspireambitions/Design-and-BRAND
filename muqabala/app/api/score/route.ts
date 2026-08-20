import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getRole, type Question, type Role } from '@/lib/roles';
import { arabicUnavailable, structureCheck, isArabicText, type AnswerFeedback } from '@/lib/scoring';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * A spoken answer caps out around 400 words. Anything far beyond that is not a
 * candidate practising — it is someone using a public endpoint as a free model.
 */
const MAX_TRANSCRIPT_CHARS = 6000;

/** Per-IP budget. Deliberately generous for a real candidate, useless for a scraper. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [key, value] of hits) if (now > value.resetAt) hits.delete(key);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const FeedbackSchema = z.object({
  headline: z.string().max(120),
  competencies: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(10),
      evidence: z.string(),
    }),
  ),
  strengths: z.array(z.string().max(400)).max(3),
  improvements: z.array(z.string().max(400)).max(3),
  coach_tip: z.string().max(600),
  /** Set when the transcript is too garbled or too short to judge fairly. */
  unscorable: z.boolean(),
});

type ParsedFeedback = z.infer<typeof FeedbackSchema>;

/**
 * Hand-written JSON Schema mirror of FeedbackSchema, for providers that take
 * OpenAI-style `response_format: json_schema`. Strict mode requires
 * `additionalProperties: false` and every property listed in `required`.
 */
const FEEDBACK_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'competencies', 'strengths', 'improvements', 'coach_tip', 'unscorable'],
  properties: {
    headline: { type: 'string' },
    competencies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score', 'evidence'],
        properties: {
          id: { type: 'string' },
          score: { type: 'number' },
          evidence: { type: 'string' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    coach_tip: { type: 'string' },
    unscorable: { type: 'boolean' },
  },
} as const;

const SYSTEM_PROMPT = `You are an interview coach for job seekers applying to roles in the Gulf (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait). Many of your users are from the Philippines, India, Pakistan, Nepal, Kenya, Nigeria, Egypt and Lebanon, and English may be their second or third language.

You score the CONTENT of an answer only. You never judge, comment on, or score: accent, pronunciation, grammar fluency, appearance, gender, nationality, age, or speaking speed. A candidate with imperfect English who tells a specific, well-structured story must score HIGHER than a fluent speaker who is vague.

The transcript you receive comes from automatic speech recognition and may contain transcription errors. Never penalise a candidate for garbled words — judge the substance you can make out. If the transcript is too garbled or too short to judge fairly, say so honestly in the headline and give a score of 0.

Candidates may answer in English or Arabic. Score an Arabic answer against exactly the same rubric, to exactly the same standard, as an English one — and write all of your feedback in the same language the candidate answered in.

Your job is to make the candidate feel capable and clear about what to do next. Be warm, direct and concrete. Never be harsh, never be flattering. Every improvement you name must be actionable in their next attempt.

Score each listed competency 0-10 against its rubric anchor, using the exact competency ids given to you and no others. Quote the candidate's actual words as evidence for each one. If no part of the answer demonstrates a competency, set its evidence to an empty string rather than quoting an unrelated line.

Set unscorable to true only when the transcript is too garbled or too short to judge fairly. When you do, explain why in the headline and improvements, and do not invent scores.`;

function buildUserPrompt(options: {
  role: Role;
  question: Question;
  transcript: string;
  jobTitle: string;
  answeredInArabic: boolean;
}): string {
  const { role, question, transcript, jobTitle, answeredInArabic } = options;
  const rubric = question.competencies
    .map((cid) => {
      const c = role.competencies.find((x) => x.id === cid);
      return c ? `- ${c.id} ("${c.label}"): ${c.anchor}` : `- ${cid}`;
    })
    .join('\n');

  return `Role: ${jobTitle} (${role.industry}, ${role.level} level, Gulf market)
Language the candidate is using: ${answeredInArabic ? 'Arabic — write all feedback in Arabic' : 'English'}

Interview question asked:
"${answeredInArabic ? question.textAr : question.text}"

Competencies to score, with their rubric anchors:
${rubric}

Candidate's transcribed answer:
"""
${transcript}
"""

Score this answer. Return one entry per competency id listed above, using those exact ids. Quote the candidate's own words as evidence. Give 1-3 strengths and 1-3 improvements, each one specific to what they actually said. The coach_tip is the single highest-leverage change they should make before their next attempt.`;
}

/**
 * OpenRouter path (OpenAI-compatible API). Model comes from SCORING_MODEL so it
 * can be changed — or A/B compared with the consistency gate — without a deploy.
 * Returns null when the provider fails or produces output that fails validation;
 * the caller falls back rather than trusting a malformed result.
 */
async function scoreViaOpenRouter(userPrompt: string): Promise<ParsedFeedback | null> {
  const model = process.env.SCORING_MODEL || 'openai/gpt-5.6';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://muqabala.app',
      'X-Title': 'Muqabala Coach',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'interview_feedback', strict: true, schema: FEEDBACK_JSON_SCHEMA },
      },
    }),
  });

  if (!response.ok) {
    console.error(`OpenRouter ${model} returned ${response.status}: ${await response.text()}`);
    return null;
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = FeedbackSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.error('OpenRouter output failed validation:', parsed.error.message);
    return null;
  }
  return parsed.data;
}

/** Anthropic path, kept as the alternative provider. */
async function scoreViaAnthropic(userPrompt: string): Promise<ParsedFeedback | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(FeedbackSchema) },
    messages: [{ role: 'user', content: userPrompt }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
  return response.parsed_output;
}

export async function POST(request: Request) {
  let body: {
    roleId?: string;
    questionId?: string;
    transcript?: string;
    lang?: 'en' | 'ar';
    /** Job title the candidate typed when practising a role not in the catalogue. */
    roleTitle?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { roleId, questionId, transcript, lang, roleTitle } = body;
  if (!roleId || !questionId || typeof transcript !== 'string') {
    return Response.json({ error: 'roleId, questionId and transcript are required.' }, { status: 400 });
  }

  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json(
      { error: 'That answer is too long to score. Please shorten it.' },
      { status: 413 },
    );
  }

  if (rateLimited(request)) {
    return Response.json(
      { error: 'Too many attempts in a short time. Please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  const role = getRole(roleId);
  const question = role?.questions.find((q) => q.id === questionId);
  if (!role || !question) {
    return Response.json({ error: 'Unknown role or question.' }, { status: 404 });
  }

  // The structure checker is English-only. Rather than hand an Arabic answer a
  // near-floor score it does not deserve, decline to score it and say why.
  const answeredInArabic = lang === 'ar' || isArabicText(transcript);
  const fallback = (): AnswerFeedback =>
    answeredInArabic ? arabicUnavailable(question.id) : structureCheck(question, transcript);

  const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const useAnthropic = !useOpenRouter && Boolean(process.env.ANTHROPIC_API_KEY);

  if (!useOpenRouter && !useAnthropic) {
    return Response.json({ feedback: fallback() });
  }

  try {
    const jobTitle = roleTitle?.trim() || role.title;
    const userPrompt = buildUserPrompt({ role, question, transcript, jobTitle, answeredInArabic });

    const parsed = useOpenRouter
      ? await scoreViaOpenRouter(userPrompt)
      : await scoreViaAnthropic(userPrompt);

    if (!parsed) {
      return Response.json({ feedback: fallback() });
    }

    // Only competencies this question actually asks for are accepted, and their
    // labels come from our rubric, not from the model. Anything else is dropped.
    const returned = new Map(parsed.competencies.map((c) => [c.id, c]));
    const competencies = question.competencies.flatMap((cid) => {
      const scored = returned.get(cid);
      if (!scored) return [];
      const def = role.competencies.find((x) => x.id === cid);
      return [
        {
          id: cid,
          label: def?.label ?? cid,
          score: Math.round(Math.max(0, Math.min(10, scored.score))),
          evidence: scored.evidence.trim() ? scored.evidence : null,
        },
      ];
    });

    // A model that scored nothing we asked for has not produced a usable result.
    if (parsed.unscorable || competencies.length === 0) {
      return Response.json({
        feedback: {
          questionId: question.id,
          score: 0,
          status: 'unscored',
          headline: parsed.headline,
          competencies: [],
          strengths: [],
          improvements: parsed.improvements.slice(0, 3),
          coachTip: parsed.coach_tip,
          source: 'ai',
        } satisfies AnswerFeedback,
      });
    }

    // The overall score is derived from the competency scores, never taken on trust.
    const overall = Math.round(
      (competencies.reduce((sum, c) => sum + c.score, 0) / competencies.length) * 10,
    );

    const feedback: AnswerFeedback = {
      questionId: question.id,
      score: overall,
      status: 'scored',
      headline: parsed.headline,
      competencies,
      strengths: parsed.strengths.slice(0, 3),
      improvements: parsed.improvements.slice(0, 3),
      coachTip: parsed.coach_tip,
      source: 'ai',
    };

    return Response.json({ feedback });
  } catch (error) {
    console.error('AI scoring failed, using structure checker:', error);
    return Response.json({ feedback: fallback() });
  }
}
