import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed } from './motion.js';

test('server: no motion', () => assert.equal(motionAllowed(undefined), false));
test('reduced motion: no motion', () => assert.equal(motionAllowed(() => ({ matches: true })), false));
test('default: motion', () => assert.equal(motionAllowed(() => ({ matches: false })), true));

import { playsEntrance } from './motion.js';
test('first load: no entrance (the prerendered page is already on screen)', () => assert.equal(playsEntrance(true, false), false));
test('a move within the site: the new page animates in', () => assert.equal(playsEntrance(false, false), true));
test('no entrance once the reader has scrolled', () => assert.equal(playsEntrance(false, true), false));
