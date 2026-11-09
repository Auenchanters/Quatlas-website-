import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitGallery } from './gallery-tags.js';

const A = new Set(['a1', 'a2']);
test('splits by tag, keeps order', () => {
  const r = splitGallery([{ _id: 'p1' }, { _id: 'a2' }, { _id: 'a1' }], A);
  assert.deepEqual(r.aircraft.map((x) => x._id), ['a2', 'a1']);
  assert.deepEqual(r.people.map((x) => x._id), ['p1']);
});
test('unknown ids go to people', () => assert.deepEqual(splitGallery([{ _id: 'new' }], A).people.length, 1));
test('hidden ids are dropped', () => assert.deepEqual(splitGallery([{ _id: 'a1' }, { _id: 'h' }], A, new Set(['h'])), { aircraft: [{ _id: 'a1' }], people: [] }));
test('empty input', () => assert.deepEqual(splitGallery([], A), { aircraft: [], people: [] }));
