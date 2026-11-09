import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flaresFor, decoyChance, waveSpec, waveNews, stepWaves, firstWave, BANNER, BREATHER, cloudField, inside, hideSpot, shouldHide, canLaunch, extremeScore } from './waves.js';

test('the ladder: guns only, then missiles, then more jets, then clouds', () => {
  const [w1, w2, w3, w4, w5] = [1, 2, 3, 4, 5].map(waveSpec);
  assert.deepEqual([w1.missiles, w1.hide], [0, false]);
  assert.ok(w2.missiles > 0 && !w2.hide && w2.count === w1.count);
  assert.ok(w3.count > w2.count && !w3.hide);
  assert.ok(w4.hide && w4.missiles > 0);
  assert.ok(w5.count > w4.count && w5.skill > w4.skill);
  assert.deepEqual([1, 4, 6].map(waveNews), ['Guns only', 'They hide in the clouds', '7 bandits, sharper pilots']);
});
test('every wave is at least as hard as the one before, and the caps hold', () => {
  for (let n = 1; n < 40; n++) {
    const a = waveSpec(n), b = waveSpec(n + 1);
    for (const k of ['count', 'missiles', 'skill', 'hp']) assert.ok(b[k] >= a[k], `${k} at wave ${n + 1}`);
    assert.ok(b.count <= 10 && b.skill <= 0.95);
  }
});
test('banner → spawn → fight until all down → breather → next banner', () => {
  let s = firstWave(), ev = [];
  const run = (secs, alive) => { for (let t = 0; t < secs; t += 0.1) { const r = stepWaves(s, 0.1, alive); s = r.state; if (r.event) ev.push(r.event); } };
  run(BANNER + 0.05, 3);
  assert.deepEqual([s.phase, ev], ['fight', ['spawn']]);
  run(30, 2);
  assert.equal(s.phase, 'fight', 'the wave holds while anyone is left');
  run(0.1, 0);
  assert.deepEqual([s.phase, ev.at(-1)], ['clear', 'cleared']);
  run(BREATHER + 0.05, 0);
  assert.deepEqual([s.wave, s.phase], [2, 'banner']);
});
test('the cloud field is fixed, spread out and clear of the start', () => {
  const a = cloudField(), b = cloudField();
  assert.deepEqual(a, b);
  for (const c of a) {
    assert.ok(c.y > 600 && c.y < 1350 && c.r >= 120);
    assert.ok(!inside([0, 900, -2600], c, 1.5), 'nobody starts inside a cloud');
    for (const o of a) if (o !== c) assert.ok(Math.hypot(o.x - c.x, o.z - c.z) > o.r + c.r);
  }
});
test('a hiding pilot runs for the nearest cloud that is not past the player', () => {
  const clouds = [{ x: 0, y: 900, z: 400, r: 150 }, { x: 0, y: 900, z: -500, r: 150 }];
  // Player ahead at z=1000: the cloud at z=400 is between them, so it picks the one behind.
  assert.equal(hideSpot([0, 900, 0], [0, 900, 1000], clouds), clouds[1]);
  // Player behind: the near cloud ahead is fine.
  assert.equal(hideSpot([0, 900, 0], [0, 900, -1000], clouds), clouds[0]);
  assert.ok(!shouldHide(waveSpec(3), { hpFrac: 0.1, threatened: true }), 'not before wave 4');
  assert.ok(shouldHide(waveSpec(4), { hpFrac: 0.5, threatened: false }));
});
test('enemy missiles: only from wave 2, in range, in sight, cooled, and not too many at once', () => {
  const ok = { left: 1, dist: 900, angle: 0.1, sight: true, cooldown: 0, chasing: 0 };
  assert.ok(!canLaunch(waveSpec(1), ok));
  assert.ok(canLaunch(waveSpec(2), ok));
  for (const bad of [{ left: 0 }, { dist: 200 }, { dist: 3000 }, { angle: 1 }, { sight: false }, { cooldown: 2 }, { chasing: 2 }]) assert.ok(!canLaunch(waveSpec(2), { ...ok, ...bad }), JSON.stringify(bad));
});
test('score rewards kills, waves and accuracy', () => {
  const base = { kills: 3, waves: 1, shots: 100, hits: 20, hp: 50 };
  assert.ok(extremeScore({ ...base, waves: 2 }) > extremeScore(base));
  assert.ok(extremeScore({ ...base, hits: 40 }) > extremeScore(base));
  assert.equal(extremeScore({ kills: 0, waves: 0, shots: 0, hits: 0, hp: -5 }), 0);
});
test('flares: none in wave 1, a full load from wave 2, and they fool missiles that are in reach but not too close', () => {
  assert.equal(flaresFor(1), 0);
  assert.ok(flaresFor(2) > 0 && flaresFor(9) === flaresFor(2));
  assert.equal(decoyChance(4000), 0);
  assert.ok(decoyChance(800) > 0.7);
  assert.ok(decoyChance(60) < decoyChance(800));
});
test('a seeker sees less far in the rain: enemies launch only within the weather range', () => {
  const ok = { left: 1, dist: 1500, angle: 0.1, sight: true, cooldown: 0, chasing: 0 };
  assert.ok(canLaunch(waveSpec(2), ok));
  assert.ok(!canLaunch(waveSpec(2), { ...ok, range: 1000 }));
});
