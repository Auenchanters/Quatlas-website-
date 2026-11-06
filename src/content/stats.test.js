import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeStats } from './stats.js';

const REC = [{ year: '2018', payloadKg: 7.25 }, { year: '2016', payloadKg: 12.5 }, { year: '2015', payloadKg: 13.6 }, { year: '2024' }];

test('stats come from the record and the club totals', () => {
  assert.deepEqual(homeStats(REC, { competitions: 25, members: 50 }), [
    { label: 'First entry', value: '2015' },
    { label: 'Competitions', value: '25', suffix: '+' },
    { label: 'Members', value: '50', suffix: '+' },
    { label: 'Heaviest payload lifted', value: '13.6', suffix: ' kg', note: '2015' },
  ]);
});
test('no payload data, no payload stat', () => {
  assert.equal(homeStats([{ year: '2020' }], { members: 5 }).some((s) => s.label.startsWith('Heaviest')), false);
});
test('a missing total hides that stat', () => {
  assert.equal(homeStats(REC, { competitions: 25 }).some((s) => s.label === 'Members'), false);
});
test('empty record gives no record-derived stats', () => {
  assert.deepEqual(homeStats([], { competitions: 25, members: 50 }), []);
});
