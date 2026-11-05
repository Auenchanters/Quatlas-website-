import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed } from './motion.js';

test('server: no motion', () => assert.equal(motionAllowed(undefined), false));
test('reduced motion: no motion', () => assert.equal(motionAllowed(() => ({ matches: true })), false));
test('default: motion', () => assert.equal(motionAllowed(() => ({ matches: false })), true));
