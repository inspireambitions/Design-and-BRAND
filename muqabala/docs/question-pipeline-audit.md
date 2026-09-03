# Candidate question pipeline audit

Date: 3 September 2026

## Root cause

The reported stem was produced in the parent of commit `aef710d` at
`lib/universal-interview/questions.ts:92`:

```ts
PROBE_SPECIFICITY: target ? `What specific example shows ${target}?` : 'What specific example can you give?',
```

`target` is interviewer guidance returned as `probe_target`. Joining that field to
a candidate-facing stem caused the first defect. The same path had no deterministic
Latin-script, second-person, punctuation or length gate, which allowed the second
defect to reach the browser.

## Question construction sites

- `lib/universal-interview/blueprint.ts:116-124` constructs fixed fallback plan
  questions. Line 120 constructs a rephrase by joining fixed text to the question.
- `lib/universal-interview/blueprint.ts:128-154` draws fallback plan questions from
  `RolePack.question_bank`.
- `lib/universal-interview/blueprint.ts:157-163` adds rephrases to model plans. Line
  162 joins fixed text to the generated question.
- `lib/universal-interview/questions.ts:50-57` converts a planned question into the
  current generated-question shape.
- `lib/universal-interview/questions.ts:88-101` applies the existing candidate-safe
  replacement logic.
- `lib/universal-interview/questions.ts:122-149` builds deterministic probe,
  clarification, redirect and hypothetical fallbacks. The historic faulty stem was
  in this function.
- `lib/universal-interview/questions.ts:152-170` builds replacement questions.
- `lib/universal-interview/api.ts:133-173` normalises model-generated plans. Line 171
  joins fixed rephrase text to a generated question.
- `lib/universal-interview/employer.ts:63-84` maps employer screening questions into
  the adaptive plan. Line 79 joins fixed rephrase text to a bank question.
- `lib/universal-interview/engine.ts:281-290` serves planned rephrases and fixed
  hypothetical questions.
- `lib/universal-interview/engine.ts:305-322` accepts a generated follow-up. Line 320
  joins fixed rephrase text to that question.
- `app/api/interview/route.ts:80-92` defines the separate advert-tailored interview
  model schema, including English question text.
- `app/api/interview/route.ts:95-111` defines its question-generation prompt, and
  `app/api/interview/route.ts:240-253` calls the model.

## Serialisation and candidate rendering

- `lib/universal-interview/api.ts:39-51` serialises the universal candidate state.
  Line 50 currently exposes `{ text }` for the current question.
- `lib/universal-interview/employer.ts:143-153` serialises the adaptive employer
  candidate state. Lines 150-151 currently expose `{ text }`.
- `components/UniversalInterview.tsx:36` types the candidate response as `{ text }`;
  line 358 renders `current_question.text`.
- `components/EmployerVideoInterview.tsx:170-176` types adaptive question state;
  lines 251-259 map it into the legacy question view; lines 874 and 889 render the
  question.
- `components/InterviewFlow.tsx:399-400` selects a legacy English or Arabic bank
  question; its recording and result screens render the selected string.
- `app/api/screening/interviews/[id]/brain/route.ts:58-71` snapshots adaptive
  questions for employer interviews and `app/api/interviews/route.ts:74-75` creates
  the first snapshot.

## Question-bank storage and schema

- The universal adaptive role-pack bank is JSON under
  `lib/universal-interview/role-packs/*.json`. Its schema is
  `RolePackQuestion` in `lib/universal-interview/types.ts:190-195` with `text`,
  `question_type`, `target_competencies` and `intent`. It is loaded by
  `lib/universal-interview/role-packs/index.ts:1-30`.
- The broader catalogue bank is TypeScript data in `lib/roles/banks.ts:19-152` and
  the role files under `lib/roles/*.ts`. Its `Question` schema is defined at
  `lib/roles/shared.ts:30-48`; all rows are created by `q` at lines 194-214 or `qt`
  at lines 216-218.
- `lib/roles/index.ts:36-55` attaches the shared service, technical or care bank to
  each catalogue role.

## Model question prompts

- `lib/universal-interview/prompts.ts:33-36` contains `PLAN_INSTRUCTIONS`, and
  `planInput` at lines 38-47 requests the eight planned main questions.
- `lib/universal-interview/prompts.ts:77-84` contains `QUESTION_INSTRUCTIONS`, and
  `questionInput` at lines 86-103 requests probes, replacements, clarifications,
  redirects, hypotheticals and rephrases.
- `lib/universal-interview/process-turn.ts:45-71` invokes the follow-up generator and
  performs its current semantic retry.
- `lib/universal-interview/model.ts:22-67` is the shared structured-output caller.
- `app/api/interview/route.ts:95-111` is the separate prompt for advert-tailored
  bank generation.

## Tests and CI

- The repository uses Node's built-in test runner. Commands are defined in
  `package.json:8-25`; universal tests run through `test:universal`.
- Universal fixtures and engine integration tests are in
  `scripts/universal-interview.test.mjs`.
- No `.github` directory or other checked-in CI workflow exists at the time of this
  audit. A workflow must therefore be added so the new validator, bank check and
  candidate-file grep run in CI.
