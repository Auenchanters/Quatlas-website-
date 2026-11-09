// The compiled core (core.wasm, built from core.cpp by `npm run wasm`), checked against logic.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import { createPlane, fly, steerToward, groundAt } from '../logic.js';
import { loadCore, PS } from './core.js';

const core = await loadCore(readFileSync(new URL('./core.wasm', import.meta.url)));
const { P } = core;
const place = (i, { pos = [0, 1000, 0], quat = [0, 0, 0, 1], speed = 140, team = 0, alive = 1 } = {}) => {
  P.fill(0, i * PS, i * PS + PS);
  P.set([...pos, ...quat, 0, 0, 0, speed, 60, 190, 1, 100, alive, team, 9], i * PS);
};
const at = (i) => [...P.subarray(i * PS, i * PS + 3)];

test('flight matches logic.js', () => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), 0.9);
  const js = createPlane({ pos: new Vector3(10, 1000, -40), quat: q });
  place(0, { pos: [10, 1000, -40], quat: [q.x, q.y, q.z, q.w] });
  const input = { pitch: 0.6, roll: -0.4, yaw: 0.3, throttle: 0.8 };
  for (let k = 0; k < 240; k++) { fly(js, input, 1 / 60); core.x.fly(0, input.pitch, input.roll, input.yaw, input.throttle, 1 / 60); }
  const d = Math.hypot(...at(0).map((c, k) => c - js.pos.getComponent(k)));
  assert.ok(d < 0.5, `drift ${d.toFixed(3)} m after 4 s`);
});
test('steering matches logic.js, and the terrain matches groundAt', () => {
  place(0, { quat: [0.1, 0.4, -0.2, 0.89] });
  const js = createPlane({ quat: new Quaternion(...P.subarray(3, 7)) });
  for (const dir of [[1, 0.2, 0.3], [-0.5, -0.8, 0.1], [0, 0.1, -1], [0.2, 0.9, 0.1]]) {
    const want = steerToward(js, new Vector3(...dir));
    core.x.steer(0, ...dir);
    const got = core.OUT;
    for (const [k, i] of [['pitch', 0], ['roll', 1], ['yaw', 2]]) assert.ok(Math.abs(got[i] - want[k]) < 1e-3, `${k} for ${dir}: ${got[i]} vs ${want[k]}`);
  }
  for (const [x, z] of [[0, 0], [1234, -2222], [-3000, 900], [400, 3500]]) assert.ok(Math.abs(core.x.ground(x, z) - groundAt(x, z)) < 0.05);
});
test('guns: a bullet fired at a plane hits it once; own team is never hit', () => {
  place(0, { pos: [0, 1000, 0], team: 0 });
  place(1, { pos: [0, 1000, 300], team: 1 });
  place(2, { pos: [0, 1000, 150], team: 0 }); // a wingman in the way
  let n = core.x.fire(0, 0, 0);
  assert.equal(n, 1);
  let hits = [];
  for (let k = 0; k < 60 && n; k++) { n = core.x.stepBullets(n, 3, 1 / 60); hits.push(...core.hitList()); }
  assert.deepEqual(hits.map((h) => h.plane), [1]);
  assert.equal(n, 0, 'the bullet is spent');
  n = core.x.fire(0, 0, 0); P[1 * PS + 15] = 0; // target gone: the bullet flies out its life
  for (let k = 0; k < 120 && n; k++) n = core.x.stepBullets(n, 3, 1 / 60);
  assert.equal(n, 0, 'timed out');
});
test('clouds block sight, locks and missile guidance', () => {
  place(0, { pos: [0, 1000, 0], team: 0 });
  place(1, { pos: [0, 1000, 800], team: 1 });
  core.C.set([0, 1000, 400, 150]);
  assert.equal(core.x.sight(0, 1, 0), 1, 'no clouds counted: clear');
  assert.equal(core.x.sight(0, 1, 1), 0, 'cloud between');
  assert.equal(core.x.lockable(0, 2, 1, 0.35, 1600), -1);
  assert.equal(core.x.lockable(0, 2, 0, 0.35, 1600), 1);
  P[1 * PS + 15] = 1; P.set([0, 1000, 400], 1 * PS);
  assert.equal(core.x.cloudAt(1, 1), 0, 'inside the cloud');
  assert.equal(core.x.cloudAt(0, 1), -1);
});
test('a missile chases a turning target and hits; one whose target hides flies on', () => {
  place(0, { pos: [0, 1000, 0], team: 0 });
  place(1, { pos: [150, 1000, 600], team: 1, speed: 150 });
  let n = core.x.launch(0, 1, 2.4, 0), hit = false;
  for (let k = 0; k < 600 && n; k++) {
    core.x.fly(1, 0, 0.6, 0, 1, 1 / 60);
    core.x.stepBullets(0, 2, 1 / 60);
    n = core.x.stepMissiles(n, 2, 0, 1 / 60);
    if (core.hitList().some((h) => h.plane === 1 && h.kind === 1)) hit = true;
  }
  assert.ok(hit, 'hit');
  place(1, { pos: [0, 1000, 900], team: 1 });
  core.C.set([0, 1000, 900, 200]);
  n = core.x.launch(0, 1, 2.4, 0);
  core.x.stepBullets(0, 2, 1 / 60);
  n = core.x.stepMissiles(n, 2, 1, 1 / 60);
  assert.equal(core.M[9], -1, 'lost the target in the cloud');
});
test('the math helpers are accurate', () => {
  place(0, { quat: [0, 0, 0, 1] });
  for (const [x, y, z] of [[0, 0, 1], [1, 0, 0], [0, 1, 1], [-1, -1, -1], [0.3, -0.2, -0.9]]) {
    place(1, { pos: [x * 500, 1000 + y * 500, z * 500] });
    core.x.bearing(0, 1);
    const want = Math.acos(z / Math.hypot(x, y, z));
    assert.ok(Math.abs(core.OUT[0] - want) < 1e-3, `bearing ${[x, y, z]}: ${core.OUT[0]} vs ${want}`);
  }
});
