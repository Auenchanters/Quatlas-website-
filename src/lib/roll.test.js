import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitStat } from './roll.js';

test('decimal', () => assert.deepEqual(splitStat('7.25'), [{ digit: 7 }, { text: '.' }, { digit: 2 }, { digit: 5 }]));
test('ordinal', () => assert.deepEqual(splitStat('1st'), [{ digit: 1 }, { text: 'st' }]));
test('plus', () => assert.deepEqual(splitStat('40+'), [{ digit: 4 }, { digit: 0 }, { text: '+' }]));
test('number input', () => assert.deepEqual(splitStat(2015), [{ digit: 2 }, { digit: 0 }, { digit: 1 }, { digit: 5 }]));
test('no digits', () => assert.deepEqual(splitStat('N/A'), [{ text: 'N/A' }]));
test('empty', () => assert.deepEqual(splitStat(''), []));
