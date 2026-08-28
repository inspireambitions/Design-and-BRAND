import assert from 'node:assert/strict';
import test from 'node:test';
import { ScreeningPackRequestSchema } from '../lib/screening-pack-request.ts';

test('screening links allow an omitted workplace but still require a signed interview token', () => {
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
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
