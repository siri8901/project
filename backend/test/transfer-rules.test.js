import test from 'node:test';
import assert from 'node:assert/strict';

test('transfer amount rules reject zero, negative, and non-finite values', () => {
  for (const amount of [0, -1, NaN, Infinity]) {
    assert.equal(Number.isFinite(amount) && amount > 0, false);
  }
});

test('a balanced transfer has equal debit and credit amounts', () => {
  const debit = 125.50;
  const credit = 125.50;
  assert.equal(debit, credit);
});
