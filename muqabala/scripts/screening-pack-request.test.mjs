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
  const customised = ScreeningPackRequestSchema.safeParse({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    interviewToken: 'signed-practice-token',
    maxCandidates: 100,
    expiryDays: 21,
  });
  assert.equal(customised.success, true);
  if (customised.success) {
    assert.equal(customised.data.maxCandidates, 100);
    assert.equal(customised.data.expiryDays, 21);
  }
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      companyName: 'Nour Clinic',
      interviewToken: 'signed-practice-token',
      maxCandidates: 1001,
      expiryDays: 14,
    }).success,
    false,
  );
  assert.equal(
    ScreeningPackRequestSchema.safeParse({
      companyName: 'Nour Clinic',
      interviewToken: 'signed-practice-token',
      maxCandidates: 100,
      expiryDays: 31,
    }).success,
    false,
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
