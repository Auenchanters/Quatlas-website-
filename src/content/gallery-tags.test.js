import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visible } from './gallery-tags.js';

const H = new Set(['h']);
test('drops hidden ids, keeps order', () => assert.deepEqual(visible([{ _id: 'b' }, { _id: 'h' }, { _id: 'a' }], H).map((x) => x._id), ['b', 'a']));
test('new uploads show', () => assert.equal(visible([{ _id: 'new' }], H).length, 1));
test('empty input', () => assert.deepEqual(visible([], H), []));
