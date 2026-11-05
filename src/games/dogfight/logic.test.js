import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import {
  createPlane, fly, steerToward, forwardOf, leadPoint, hitSphere, stepBullets, fireBullet,
  createMissile, stepMissile, lockCandidate, think, heightAt, crashed, finalScore, RIGHT,
} from './logic.js';

const level = () => createPlane({ pos: new Vector3(0, 1000, 0) });
const flyFor = (p, input, secs) => { for (let t = 0; t < secs; t += 1 / 60) fly(p, input, 1 / 60); return p; };

test('pitch up climbs, roll right drops the right wing, yaw right turns right', () => {
  assert.ok(flyFor(level(), { pitch: 1, roll: 0, yaw: 0, throttle: 0.7 }, 1).pos.y > 1010);
  const r = flyFor(level(), { pitch: 0, roll: 1, yaw: 0, throttle: 0.7 }, 0.3);
  assert.ok(RIGHT.clone().applyQuaternion(r.quat).y < -0.3);
  const y = flyFor(level(), { pitch: 0, roll: 0, yaw: 1, throttle: 0.7 }, 1);
  assert.ok(y.pos.x < -5, 'right is −X');
});
test('throttle sets speed; climbing bleeds it', () => {
  const fast = flyFor(level(), { pitch: 0, roll: 0, yaw: 0, throttle: 1 }, 6), slow = flyFor(level(), { pitch: 0, roll: 0, yaw: 0, throttle: 0 }, 6);
  assert.ok(fast.speed > slow.speed + 60);
});
test('steering: target above pulls up, target right banks and yaws right', () => {
  const up = steerToward(level(), new Vector3(0, 1, 1));
  assert.ok(up.pitch > 0.5);
  const right = steerToward(level(), new Vector3(-1, 0, 0.2));
  assert.ok(right.roll > 0.5 && right.yaw > 0);
});
test('steering toward a direction lines the nose up with it, even one behind', () => {
  for (const dir of [new Vector3(-1, 0.3, 0.2), new Vector3(0.5, -0.2, -1)]) {
    const p = level();
    for (let i = 0; i < 60 * 6; i++) fly(p, { ...steerToward(p, dir), throttle: 0.7 }, 1 / 60);
    assert.ok(forwardOf(p).angleTo(dir) < 0.1);
  }
});
test('lead point: still target is itself, moving target is ahead of it', () => {
  const from = new Vector3();
  assert.deepEqual(leadPoint(from, new Vector3(0, 0, 900), new Vector3()).toArray(), [0, 0, 900]);
  assert.ok(leadPoint(from, new Vector3(0, 0, 900), new Vector3(100, 0, 0)).x > 90);
});
test('hitSphere catches a segment passing through, misses one passing wide', () => {
  assert.equal(hitSphere(new Vector3(0, 0, -10), new Vector3(0, 0, 10), new Vector3(1, 0, 0), 2), true);
  assert.equal(hitSphere(new Vector3(0, 0, -10), new Vector3(0, 0, 10), new Vector3(5, 0, 0), 2), false);
});
test('bullets hit enemies but never their own team', () => {
  const me = level(), foe = createPlane({ pos: new Vector3(0, 1000, 200), team: 'blue' }), mate = createPlane({ pos: new Vector3(0, 1000, 100) });
  const b = fireBullet(me, 'red');
  const hits = []; for (let i = 0; i < 30; i++) hits.push(...stepBullets([b], [mate, foe], 1 / 60));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].plane, foe);
});
test('a missile homes onto a crossing target', () => {
  const me = level(), foe = createPlane({ pos: new Vector3(-300, 1050, 900), team: 'blue' });
  foe.vel.set(-80, 0, 0);
  const m = createMissile(me, foe);
  let hit = false;
  for (let i = 0; i < 60 * 6 && !hit; i++) { foe.pos.addScaledVector(foe.vel, 1 / 60); hit = stepMissile(m, 1 / 60); }
  assert.equal(hit, true);
});
test('lock-on picks an enemy inside the cone, not one behind', () => {
  const me = level();
  const ahead = createPlane({ pos: new Vector3(20, 1000, 800), team: 'blue' }), behind = createPlane({ pos: new Vector3(0, 1000, -300), team: 'blue' });
  assert.equal(lockCandidate(me, [behind, ahead]), ahead);
  assert.equal(lockCandidate(me, [behind]), null);
});
test('enemy AI climbs when low, fires when lined up, evades when hit', () => {
  const player = createPlane({ pos: new Vector3(0, 1000, 400) });
  const low = createPlane({ pos: new Vector3(0, groundSafe(0, 0) + 60, 0), team: 'blue' });
  assert.equal(think(low, player, 0).mode, 'climb');
  const shooter = createPlane({ pos: new Vector3(0, 1000, 0), team: 'blue' });
  const d = think(shooter, player, 0, 1);
  assert.equal(d.mode, 'pursue'); assert.equal(d.fire, true);
  shooter.evadeUntil = 5;
  assert.equal(think(shooter, player, 1).mode, 'evade');
});
test('terrain is deterministic and the sea counts as ground', () => {
  assert.equal(heightAt(123, 456), heightAt(123, 456));
  assert.equal(crashed(createPlane({ pos: new Vector3(0, -1, 0) })), true);
});
test('score rewards kills, a fast full win, accuracy and health', () => {
  assert.equal(finalScore({ kills: 4, time: 100, shots: 100, hits: 25, hp: 50 }), 2000 + 2000 + 500 + 500);
  assert.equal(finalScore({ kills: 1, time: 100, shots: 0, hits: 0, hp: 0 }), 500);
});

function groundSafe(x, z) { return Math.max(0, heightAt(x, z)); }
void Quaternion;
