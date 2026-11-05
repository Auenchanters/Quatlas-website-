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

import { fetchAllowed } from './img.js';
const fake = (map) => async (u) => { const r = map[u]; if (!r) throw new Error('unexpected fetch ' + u); return { status: r.status, headers: new Headers(r.headers ?? {}), url: u, ok: r.status < 300, body: null }; };
test('redirects are followed only while every hop stays on an allowed host', async () => {
  const ok = await fetchAllowed(new URL('https://1drv.ms/i/x'), fake({
    'https://1drv.ms/i/x': { status: 301, headers: { location: 'https://onedrive.live.com/y' } },
    'https://onedrive.live.com/y': { status: 200 },
  }));
  assert.equal(ok.status, 200);
  const bad = await fetchAllowed(new URL('https://1drv.ms/i/x'), fake({
    'https://1drv.ms/i/x': { status: 302, headers: { location: 'http://169.254.169.254/latest' } },
  }));
  assert.equal(bad, null);
});
