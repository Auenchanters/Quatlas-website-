import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upiLink } from './upi.js';

test('encodes payee', () =>
  assert.equal(upiLink({ pa: 'mohithjagadish28@oksbi', pn: 'Mohith Jagadish' }), 'upi://pay?pa=mohithjagadish28%40oksbi&pn=Mohith%20Jagadish&cu=INR'));
