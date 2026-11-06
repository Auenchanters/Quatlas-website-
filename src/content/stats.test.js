import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeStats } from './stats.js';

const REC = [{ year: '2018' }, { year: '2016' }, { year: '2015' }, { year: '2024' }];
const BEST = { value: '5th place', label: 'SAE Competition', note: '2019' };

test('first year from the record, then the totals and the highlight', () => {
  assert.deepEqual(homeStats(REC, { competitions: 25, members: 50 }, BEST), [
    { label: 'First entry', value: '2015' },
    { label: 'Competitions', value: '25', suffix: '+' },
    { label: 'Members', value: '50', suffix: '+' },
    BEST,
  ]);
});
test('no highlight, no highlight stat', () => {
  assert.equal(homeStats([{ year: '2020' }], { members: 5 }).length, 2);
});
test('a missing total hides that stat', () => {
  assert.equal(homeStats(REC, { competitions: 25 }, BEST).some((s) => s.label === 'Members'), false);
});
test('empty record gives no stats', () => {
  assert.deepEqual(homeStats([], { competitions: 25, members: 50 }, BEST), []);
});
