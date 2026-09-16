import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  PILOT_PENDING_KEY, PILOT_RECEIPT_KEY, maskPilotEmail, readPilotPending,
  savePilotPending, readPilotReceipt, savePilotReceipt, clearPilotStorage, parsePilotResponse,
} from '../lib/schools/pilot-receipt.ts';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('pending UUID survives refresh without saving enquiry content', () => {
  const state = storage(), id = randomUUID();
  assert.equal(savePilotPending(id, () => state), true);
  assert.equal(readPilotPending(() => state), id);
  assert.deepEqual([...state.values], [[PILOT_PENDING_KEY, id]]);
});
test('receipt retains only reference and masked email, even if passed additional fields', () => {
  const state = storage();
  const receipt = { reference: 'PILOT-test-reference', maskedEmail: maskPilotEmail('adviser@example.test') };
  assert.equal(savePilotReceipt({ ...receipt, email: 'adviser@example.test', message: 'Private message' }, () => state), true);
  assert.deepEqual(readPilotReceipt(() => state), receipt);
  assert.deepEqual(JSON.parse(state.getItem(PILOT_RECEIPT_KEY)), receipt);
  assert.equal(state.getItem(PILOT_RECEIPT_KEY).includes('adviser@example.test'), false);
  assert.equal(state.getItem(PILOT_RECEIPT_KEY).includes('Private message'), false);
});
test('storage getters and operations may fail without breaking submission', () => {
  for (const provider of [
    () => { throw new Error('Storage disabled'); },
    () => ({ getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } }),
  ]) {
    assert.equal(readPilotPending(provider), null);
    assert.equal(readPilotReceipt(provider), null);
    assert.equal(savePilotPending(randomUUID(), provider), false);
    assert.equal(savePilotReceipt({reference:'test', maskedEmail:'a***@example.test'}, provider), false);
    assert.equal(clearPilotStorage(provider), false);
  }
});
test('malformed stored data cannot become a success receipt or retry key', () => {
  const state = storage();
  for (const value of ['not json', 'null', '{}', '{"reference":"x","maskedEmail":"raw@example.test"}', '{"reference":"","maskedEmail":"a***@example.test"}']) {
    state.setItem(PILOT_RECEIPT_KEY, value);
    assert.equal(readPilotReceipt(() => state), null);
  }
  state.setItem(PILOT_PENDING_KEY, 'invalid-key');
  assert.equal(readPilotPending(() => state), null);
});
test('new enquiry clears only its own storage keys', () => {
  const state = storage();
  state.setItem('unrelated', 'keep');
  savePilotPending(randomUUID(), () => state);
  savePilotReceipt({ reference:'x', maskedEmail:'a***@example.test' }, () => state);
  assert.equal(clearPilotStorage(() => state), true);
  assert.deepEqual([...state.values], [['unrelated', 'keep']]);
});
test('only an explicit valid backend receipt is definitive success', () => {
  for (const acknowledgement of ['queued', 'unavailable']) {
    assert.deepEqual(parsePilotResponse({ reference:'ref-123', acknowledgement }), {reference:'ref-123', acknowledgement});
  }
  for (const body of [null, {}, {reference:'ref-123'}, {reference:'ref-123', acknowledgement:'delivered'}, {reference:'', acknowledgement:'queued'}]) {
    assert.equal(parsePilotResponse(body), null);
  }
});
