import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widthFor, readCapped } from './img.js';

test('widths snap to the three sizes the site uses, so the cache stays small', () => {
  assert.equal(widthFor('50'), 400);
  assert.equal(widthFor('401'), 800);
  assert.equal(widthFor('1599'), 1600);
  assert.equal(widthFor('99999'), 1600);
  assert.equal(widthFor('nope'), 800);
});
test('readCapped stops reading as soon as the body passes the cap', async () => {
  let pulled = 0;
  const body = new ReadableStream({ pull(c) { pulled++; c.enqueue(new Uint8Array(1000)); } });
  assert.equal(await readCapped(body, 2500), null);
  assert.ok(pulled <= 4);
  const small = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } });
  assert.deepEqual([...await readCapped(small, 10)], [1, 2, 3]);
});
