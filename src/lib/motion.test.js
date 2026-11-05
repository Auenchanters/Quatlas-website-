import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed } from './motion.js';

test('server: no motion', () => assert.equal(motionAllowed(undefined), false));
test('reduced motion: no motion', () => assert.equal(motionAllowed(() => ({ matches: true })), false));
test('default: motion', () => assert.equal(motionAllowed(() => ({ matches: false })), true));

import { playsEntrance } from './motion.js';
test('entrance plays when motion arrives quickly', () => assert.equal(playsEntrance(120, false), true));
test('no entrance when motion arrives late (content already read)', () => assert.equal(playsEntrance(900, false), false));
test('no entrance once the reader has scrolled', () => assert.equal(playsEntrance(50, true), false));
