import assert from 'node:assert/strict';
import test from 'node:test';
import { ScreeningPackRequestSchema } from '../lib/screening-pack-request.ts';

test('screening links require a company name and a signed interview token', () => {
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      jobTitle: 'Receptionist',
      interviewToken: 'signed-practice-token',
    }).success,
    false,
  );
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      companyName: 'Nour Clinic',
      jobTitle: 'Receptionist',
      interviewToken: 'signed-practice-token',
    }).success,
    true,
  );
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      workplace: 'Nour Clinic',
      jobTitle: 'Receptionist',
      interviewToken: 'signed-practice-token',
    }).success,
    true,
  );
  assert.equal(ScreeningPackRequestSchema.safeParse({ jobTitle: 'Receptionist' }).success, false);
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      jobTitle: 'Receptionist',
      interviewToken: 'signed-practice-token',
      unexpected: true,
    }).success,
    false,
  );
});
