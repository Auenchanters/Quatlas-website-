import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeStats } from './stats.js';

const REC = [{ year: '2018', payloadKg: 7.25 }, { year: '2016', payloadKg: 12.5 }, { year: '2015', payloadKg: 13.6 }, { year: '2024' }];

test('stats come from the record and the member count', () => {
  assert.deepEqual(homeStats(REC, 42), [
    { label: 'First entry', value: '2015' },
    { label: 'Competitions', value: '4' },
    { label: 'Members', value: '42' },
    { label: 'Heaviest payload lifted', value: '13.6', suffix: ' kg', note: '2015' },
  ]);
});
test('no payload data, no payload stat', () => {
  assert.equal(homeStats([{ year: '2020' }], 5).some((s) => s.label.startsWith('Heaviest')), false);
});
test('no members, no members stat', () => {
  assert.equal(homeStats(REC, 0).some((s) => s.label === 'Members'), false);
});
test('empty record gives no record-derived stats', () => {
  assert.deepEqual(homeStats([], 0), []);
});
