import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getRole } from '@/lib/roles';
import { arabicUnavailable, demoScore, isArabicText, type AnswerFeedback } from '@/lib/scoring';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FeedbackSchema = z.object({
  score: z.number().min(0).max(100),
  headline: z.string(),
  competencies: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      score: z.number().min(0).max(10),
      evidence: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  coach_tip: z.string(),
});

const SYSTEM_PROMPT = `You are an interview coach for job seekers applying to roles in the Gulf (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait). Many of your users are from the Philippines, India, Pakistan, Nepal, Kenya, Nigeria, Egypt and Lebanon, and English may be their second or third language.

You score the CONTENT of an answer only. You never judge, comment on, or score: accent, pronunciation, grammar fluency, appearance, gender, nationality, age, or speaking speed. A candidate with imperfect English who tells a specific, well-structured story must score HIGHER than a fluent speaker who is vague.

The transcript you receive comes from automatic speech recognition and may contain transcription errors. Never penalise a candidate for garbled words — judge the substance you can make out. If the transcript is too garbled or too short to judge fairly, say so honestly in the headline and give a score of 0.

Candidates may answer in English or Arabic. Score an Arabic answer against exactly the same rubric, to exactly the same standard, as an English one — and write all of your feedback in the same language the candidate answered in.

Your job is to make the candidate feel capable and clear about what to do next. Be warm, direct and concrete. Never be harsh, never be flattering. Every improvement you name must be actionable in their next attempt.

Score each listed competency 0-10 against its rubric anchor, and quote the candidate's actual words as evidence for each one. If no part of the answer demonstrates a competency, set its evidence to an empty string rather than quoting an unrelated line. The overall score is 0-100.`;

export async function POST(request: Request) {
  let body: {
    roleId?: string;
    questionId?: string;
    transcript?: string;
    lang?: 'en' | 'ar';
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { roleId, questionId, transcript, lang } = body;
  if (!roleId || !questionId || typeof transcript !== 'string') {
    return Response.json({ error: 'roleId, questionId and transcript are required.' }, { status: 400 });
  }

  const role = getRole(roleId);
  const question = role?.questions.find((q) => q.id === questionId);
  if (!role || !question) {
    return Response.json({ error: 'Unknown role or question.' }, { status: 404 });
  }

  // The heuristic scorer is English-only. Rather than hand an Arabic answer a
  // near-floor score it does not deserve, decline to score it and say why.
  const answeredInArabic = lang === 'ar' || isArabicText(transcript);
  const fallback = (): AnswerFeedback =>
    answeredInArabic ? arabicUnavailable(question.id) : demoScore(question, role, transcript);

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ feedback: fallback() });
  }

  try {
    const client = new Anthropic();
    const rubric = question.competencies
      .map((cid) => {
        const c = role.competencies.find((x) => x.id === cid);
        return c ? `- ${c.id} ("${c.label}"): ${c.anchor}` : `- ${cid}`;
      })
      .join('\n');

    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(FeedbackSchema) },
      messages: [
        {
          role: 'user',
          content: `Role: ${role.title} (${role.industry}, ${role.level} level, Gulf market)
Language the candidate is using: ${answeredInArabic ? 'Arabic — write all feedback in Arabic' : 'English'}

Interview question asked:
"${answeredInArabic ? question.textAr : question.text}"

Competencies to score, with their rubric anchors:
${rubric}

Candidate's transcribed answer:
"""
${transcript}
"""

Score this answer. For each competency, quote the candidate's own words as evidence. Give 1-3 strengths and 1-3 improvements, each one specific to what they actually said. The coach_tip is the single highest-leverage change they should make before their next attempt.`,
        },
      ],
    });

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return Response.json({ feedback: fallback() });
    }

    const parsed = response.parsed_output;
    const feedback: AnswerFeedback = {
      questionId: question.id,
      score: Math.round(parsed.score),
      headline: parsed.headline,
      competencies: parsed.competencies.map((c) => ({
        id: c.id,
        label: c.label,
        score: Math.round(c.score),
        evidence: c.evidence.trim() ? c.evidence : null,
      })),
      strengths: parsed.strengths.slice(0, 3),
      improvements: parsed.improvements.slice(0, 3),
      coachTip: parsed.coach_tip,
      source: 'ai',
    };

    return Response.json({ feedback });
  } catch (error) {
    console.error('AI scoring failed, using demo scorer:', error);
    return Response.json({ feedback: fallback() });
  }
}
