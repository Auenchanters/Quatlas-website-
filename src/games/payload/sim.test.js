import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, step, score, H, GROUND, CEIL, PLANE_X } from './sim.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const run = (s, hold, frames) => { for (let i = 0; i < frames && !s.over; i++) step(s, hold, 1, () => 0.5); return s; };

test('holding climbs and drains the battery; letting go sinks and recharges', () => {
  const a = run(fresh(), true, 10);
  assert.ok(a.y < H / 2 && a.battery < 1);
  const b = fresh(); b.battery = 0.5; run(b, false, 10);
  assert.ok(b.y > H / 2 && b.battery > 0.5);
});
test('an empty battery cannot climb', () => {
  const s = fresh(); s.battery = 0; run(s, true, 5);
  assert.ok(s.vy > 0);
});
test('ground and ceiling end the flight', () => {
  const g = fresh(); g.y = GROUND - 15; g.vy = 5; step(g, false, 1, () => 0.5);
  assert.equal(g.over, 'Hit the ground');
  const c = fresh(); c.y = CEIL + 11; c.vy = -5; step(c, true, 1, () => 0.5);
  assert.equal(c.over, 'Broke the altitude ceiling');
});
test('crates add payload, cells recharge, both emit a pickup event', () => {
  const s = fresh(); s.next = 1e9; s.battery = 0.9;
  s.items.push({ kind: 'crate', x: PLANE_X + 4, y: s.y, r: 13 }, { kind: 'cell', x: PLANE_X + 4, y: s.y, r: 13 });
  step(s, false, 1, () => 0.5);
  assert.equal(s.kg, 0.5);
  assert.equal(s.battery, 1);
  assert.deepEqual(s.events.map((e) => e.type + ':' + e.kind), ['pickup:crate', 'pickup:cell']);
});
test('flying into a pylon ends the flight', () => {
  const s = fresh(); s.next = 1e9;
  s.items.push({ kind: 'pylon', x: PLANE_X, top: s.y + 40, gap: 150, w: 26 });
  step(s, false, 1, () => 0.5);
  assert.equal(s.over, 'Clipped a pylon');
});
test('pylons spawn when the spawn timer runs out', () => {
  const s = fresh(); s.next = 0.1;
  step(s, false, 1, seq(0.5, 0.9, 0.9));
  assert.ok(s.items.some((i) => i.kind === 'pylon'));
});
test('score: a point per 10 m, fifty per kg', () => {
  assert.equal(score({ dist: 1234, kg: 1.5 }), 123 + 75);
});
