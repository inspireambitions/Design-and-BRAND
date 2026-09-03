import 'server-only';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { ModelCallBudget } from './model-budget.ts';

export { ModelCallBudget } from './model-budget.ts';

type Stage = 'P1' | 'P2' | 'T1' | 'T2' | 'F1';

function modelFor(stage: Stage): string {
  const stageModel = process.env[`UNIVERSAL_${stage}_MODEL`];
  return stageModel || process.env.OPENAI_SCORING_MODEL || 'gpt-5.6-sol';
}

function effortFor(stage: Stage): 'low' | 'medium' | 'high' {
  const raw = process.env[`UNIVERSAL_${stage}_REASONING`] || 'low';
  return raw === 'low' || raw === 'high' ? raw : 'medium';
}

export async function callStructured<Schema extends z.ZodType>(input: {
  stage: Stage;
  schemaName: string;
  schema: Schema;
  instructions: string;
  prompt: string;
  budget: ModelCallBudget;
  allowValidationRetry?: boolean;
}): Promise<z.output<Schema> | null> {
  if (!process.env.OPENAI_API_KEY || input.budget.remaining <= 0) return null;
  const timeout = input.stage === 'F1'
    ? 12_000
    : input.stage === 'T2'
      ? 8_000
      : input.stage === 'T1'
        ? 10_000
        : 12_000;
  const client = new OpenAI({ timeout, maxRetries: 0 });
  let validationError = '';
  const attempts = input.allowValidationRetry === false ? 1 : 2;

  for (let attempt = 0; attempt < attempts && input.budget.remaining > 0; attempt += 1) {
    input.budget.use();
    if (attempt > 0) input.budget.markRetry();
    try {
      const response = await client.responses.parse({
        model: modelFor(input.stage),
        ...(input.stage === 'P2' || input.stage === 'T2' ? { temperature: 0.3 } : {}),
        instructions: input.instructions,
        input: validationError ? `${input.prompt}\n\nYour previous output failed validation: ${validationError}. Return a corrected object.` : input.prompt,
        reasoning: { effort: effortFor(input.stage) },
        text: { format: zodTextFormat(input.schema, input.schemaName) },
        max_output_tokens: input.stage === 'P2' || input.stage === 'F1' ? 4500 : 3000,
        store: false,
      });
      const parsed = input.schema.safeParse(response.output_parsed);
      if (parsed.success) return parsed.data;
      validationError = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ').slice(0, 1000);
    } catch (error) {
      validationError = error instanceof Error ? error.message.slice(0, 1000) : 'invalid output';
      const safeError = error as { status?: number; code?: string; name?: string };
      console.warn('universal_model_call_failed', {
        stage: input.stage,
        attempt: attempt + 1,
        model: modelFor(input.stage),
        status: safeError?.status ?? null,
        code: safeError?.code ?? null,
        name: safeError?.name ?? 'UnknownError',
      });
    }
  }
  return null;
}
