import assert from 'node:assert/strict';
import test from 'node:test';
import { zodTextFormat } from 'openai/helpers/zod';

import {
  formatGeneratedJobDescription,
  GeneratedJobDescriptionSchema,
  JobDescriptionRequestSchema,
} from '../lib/job-description.ts';

const generated = {
  summary: 'Lead clear and practical front desk service for guests, from arrival through departure, while keeping records accurate and requests moving between teams.',
  responsibilities: [
    'Welcome guests and complete check-in and check-out with accurate records.',
    'Answer guest questions clearly and keep each person informed about next steps.',
    'Own service problems and coordinate practical solutions with relevant hotel teams.',
    'Record guest requests accurately and follow through before closing each request.',
    'Handle payments and front desk documents carefully under the company procedure.',
    'Share clear shift updates so colleagues can continue open guest requests.',
  ],
  requirements: [
    'Relevant customer service experience with direct responsibility for guest requests.',
    'Clear spoken and written communication suited to guests and colleagues.',
    'A calm and practical approach when priorities change or a guest is upset.',
    'Careful handling of records, payments and other confidential information.',
    'Willingness to work with colleagues and take ownership of agreed actions.',
  ],
  success_measures: [
    'Guests receive accurate information and timely updates throughout their visit.',
    'Front desk records and handovers remain complete, clear and dependable.',
    'Service problems are owned, resolved and followed through without avoidable delay.',
  ],
};

test('job-description output schema compiles for strict OpenAI structured output', () => {
  const format = zodTextFormat(GeneratedJobDescriptionSchema, 'job_description');
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
});

test('job-description input requires company and title and rejects unknown fields', () => {
  assert.equal(JobDescriptionRequestSchema.safeParse({ companyName: '', jobTitle: 'Receptionist' }).success, false);
  assert.equal(JobDescriptionRequestSchema.safeParse({ companyName: 'Nour Clinic', jobTitle: '' }).success, false);
  assert.equal(JobDescriptionRequestSchema.safeParse({ companyName: 'Nour Clinic', jobTitle: 'Receptionist', extra: true }).success, false);
  assert.equal(JobDescriptionRequestSchema.safeParse({ companyName: 'Nour Clinic', jobTitle: 'Receptionist' }).success, true);
});

test('job-description formatter produces a complete, editable vacancy draft', () => {
  const result = formatGeneratedJobDescription({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    generated,
  });
  assert.match(result, /^Receptionist\nNour Clinic/);
  assert.match(result, /Role summary/);
  assert.match(result, /Key responsibilities/);
  assert.match(result, /What you will bring/);
  assert.match(result, /Success in this role/);
});

test('job-description formatter rejects unsafe hiring criteria and invented promises', () => {
  assert.equal(formatGeneratedJobDescription({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    generated: { ...generated, requirements: [...generated.requirements.slice(0, 4), 'Applicants must be under 30 years of age for this customer-facing role.'] },
  }), null);
  assert.equal(formatGeneratedJobDescription({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    generated: { ...generated, summary: `${generated.summary} Visa provided for the successful candidate.` },
  }), null);
});

test('job-description formatter rejects repeated model filler', () => {
  assert.equal(formatGeneratedJobDescription({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    generated: { ...generated, responsibilities: Array(6).fill(generated.responsibilities[0]) },
  }), null);
});
