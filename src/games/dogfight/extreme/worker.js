// Dogfight Extreme's simulation, off the main thread. The compiled core (core.wasm) does the numbers:
// flight, steering, bullets, missiles, hits, sight lines through clouds. This file is the pilots'
// decisions and the waves. The page sends { type: 'step', dt, input } each frame and draws the state
// that comes back; nothing here touches the DOM.
import wasmUrl from './core.wasm?url';
import { loadCore, PS, BS, MS } from './core.js';
import { waveSpec, stepWaves, firstWave, cloudField, hideSpot, shouldHide, canLaunch, HIDE_TIME, HIDE_COOLDOWN, REFIT, extremeScore, FLARES, flaresFor, decoyChance } from './waves.js';
import { atmosphere, turbulence } from './atmosphere.js';

const ARENA = 4000, CEILING = 3000, AMMO = 600, MISSILES = 4, FIRE_RATE = 1 / 14;
const clouds = cloudField(), NC = clouds.length;
let core, x, P, g, atmos = atmosphere();

const ready = fetch(wasmUrl).then((r) => r.arrayBuffer()).then(loadCore).then((c) => {
  core = c; x = c.x; P = c.P;
  clouds.forEach((cl, i) => c.C.set([cl.x, cl.y, cl.z, cl.r], i * 4));
  postMessage({ type: 'ready' });
});

// Small vector helpers on [x, y, z] arrays and plane slots.
const pos = (i) => [P[i * PS], P[i * PS + 1], P[i * PS + 2]];
const fwd = (i) => { const o = i * PS + 3, [a, b, c, w] = [P[o], P[o + 1], P[o + 2], P[o + 3]]; return [2 * (a * c + w * b), 2 * (b * c - w * a), 1 - 2 * (a * a + b * b)]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((len(a) * len(b)) || 1))));
const alive = (i) => P[i * PS + 15] > 0.5;

function place(i, p, facing, { speed, min, max, agility, hp, team }) {
  const yaw = Math.atan2(facing[0], facing[2]);
  P.fill(0, i * PS, i * PS + PS);
  P.set([...p, 0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2), 0, 0, 0, speed, min, max, agility, hp, 1, team, 9], i * PS);
}

function newGame() {
  g = { np: 1, nb: 0, nm: 0, t: 0, waves: firstWave(), cleared: 0, kills: 0, shots: 0, hits: 0, ammo: AMMO, msl: MISSILES, flares: flaresFor(1), flareCool: 0, cool: 0, lock: -1, lockT: 0, beep: 0, outT: 0, warnT: 0, over: false, brains: [{}], events: [] };
  place(0, [0, 900, -2600], [0, 0, 1], { speed: 140, min: 60, max: 190, agility: 1, hp: 100, team: 0 });
  g.events.push({ type: 'wave', n: 1 });
}

// A wave arrives ahead of the player, 2.2–3 km out, spread across the sky, facing them.
function spawn() {
  const spec = waveSpec(g.waves.wave), me = pos(0), f = fwd(0), heading = Math.atan2(f[0], f[2]);
  g.np = 1 + spec.count; g.brains = [g.brains[0]];
  for (let k = 0; k < spec.count; k++) {
    const a = heading + (k - (spec.count - 1) / 2) * 0.32, d = 2200 + (k % 3) * 350;
    let p = [me[0] + Math.sin(a) * d, 0, me[2] + Math.cos(a) * d];
    const r = Math.hypot(p[0], p[2]); if (r > ARENA * 0.8) p = [p[0] * ARENA * 0.8 / r, 0, p[2] * ARENA * 0.8 / r]; // keep them inside
    p[1] = Math.max(x.ground(p[0], p[2]) + 400, Math.min(1700, me[1] + 120 + (k % 4) * 90 - 150));
    place(k + 1, p, sub(me, p), { speed: 135, min: 70, max: 170 + spec.n * 3, agility: 0.8 + spec.skill * 0.15, hp: spec.hp, team: 1 });
    g.brains.push({ msl: spec.missiles, mslCool: 3 + k, gunCool: 0 });
  }
}

function destroy(i, why) {
  if (!alive(i)) return;
  P[i * PS + 15] = 0;
  const b = g.brains[i]; b.wreck = P[i * PS + 18] = 3.5; b.spin = (Math.random() - 0.5) * 6;
  g.events.push({ type: 'explode', pos: pos(i), dist: len(sub(pos(i), pos(0))) });
  if (i) g.kills++;
  else if (!g.over) {
    g.over = true;
    const score = extremeScore({ kills: g.kills, waves: g.cleared, shots: g.shots, hits: g.hits, hp: P[14] });
    g.events.push({ type: 'over', result: { why, score, kills: g.kills, waves: g.cleared, wave: g.waves.wave, time: g.t, accuracy: g.shots ? Math.round((g.hits / g.shots) * 100) : 0 } });
  }
}

// One enemy pilot (think() in logic.js, plus hiding in cloud and missiles).
function pilot(i, spec, dt) {
  const b = g.brains[i], me = pos(i), pl = pos(0), toP = sub(pl, me), dist = len(toP), f = fwd(i), now = g.t;
  const alt = me[1] - x.ground(me[0], me[2]);
  const playerBehind = dist < 700 && angle(fwd(0), sub(me, pl)) < 0.5 && angle(f, toP) > 2.2;
  const threatened = playerBehind || (g.lock === i && g.lockT > 0.5);
  let aim, fire = false, throttle = 0.85;
  if (alt < 180 || me[1] < 120) aim = norm([f[0], 0, f[2]]).map((c, k) => (k === 1 ? 1.4 : c));
  else if (now < (b.hideUntil ?? 0) || (now > (b.hideReady ?? 0) && shouldHide(spec, { hpFrac: P[i * PS + 14] / spec.hp, threatened }))) {
    // Run for cloud; once inside, circle in it until the time is up.
    if (now >= (b.hideUntil ?? 0)) { b.cloud = hideSpot(me, pl, clouds); b.hideUntil = now + HIDE_TIME; b.hideReady = now + HIDE_TIME + HIDE_COOLDOWN; }
    const c = b.cloud, off = sub(me, [c.x, c.y, c.z]);
    aim = len(off) < c.r * 0.7 ? norm([-off[2], (c.y - me[1]) * 0.01, off[0]]) : norm(sub([c.x, c.y, c.z], me));
  } else if (now < (b.evadeUntil ?? 0) || (playerBehind && now > (b.evadeReady ?? 0))) {
    if (!b.evadeDir || now > (b.evadeUntil ?? 0)) {
      b.evadeUntil = now + 2.5; b.evadeReady = now + 2.5 + 7 * (1 - spec.skill);
      const s = Math.sign(Math.sin(now * 3.1 + me[0])) || 1;
      b.evadeDir = norm([-f[2] * s, -0.3, f[0] * s]);
    }
    aim = b.evadeDir;
  } else if (Math.hypot(me[0], me[2]) > ARENA * 0.85) aim = norm([-me[0], 900 - me[1], -me[2]]);
  else if (now < (b.extendUntil ?? 0)) aim = b.extendDir;
  else {
    x.leadOn(i, 0, 900);
    aim = norm(sub([core.OUT[0], core.OUT[1], core.OUT[2]], me));
    const off = angle(f, aim), sight = x.sight(i, 0, NC);
    fire = sight && dist < 650 && off < 0.05 + (1 - spec.skill) * 0.05;
    if (dist < 300) throttle = 0.45;
    if (dist < 600 && off > 0.6) b.knife ??= now; else b.knife = null;
    if (b.knife != null && now - b.knife > 5 - spec.skill * 2) { b.knife = null; b.extendUntil = now + 4; b.extendDir = norm([f[0], 0.15, f[2]]); }
    // Homing missiles from wave 2.
    b.mslCool -= dt;
    const chasing = countChasing();
    if (canLaunch(spec, { left: b.msl, dist, angle: angle(f, toP), sight, cooldown: b.mslCool, chasing, range: atmos.lockRange + 100 })) {
      g.nm = x.launch(i, 0, 1.5, g.nm); b.msl--; b.mslCool = 7; g.events.push({ type: 'enemyMissile' });
    }
  }
  x.steer(i, ...aim);
  const bump = turbulence(now, i, atmos.turbulence);
  x.fly(i, core.OUT[0] + bump.pitch, core.OUT[1] + bump.roll, core.OUT[2], throttle, dt);
  b.gunCool -= dt;
  if (fire && alive(0) && b.gunCool <= 0) { g.nb = x.fire(i, 0.03 - spec.skill * 0.015, g.nb); b.gunCool = 0.11; }
}
// A flare salvo behind the jet: each missile chasing the player may turn for it instead, losing the player.
function dropFlares() {
  g.flares--; g.flareCool = FLARES.cooldown;
  const me = pos(0), v = [P[7], P[8], P[9]], at = [me[0] - v[0] * 0.4, me[1] - v[1] * 0.4 - 10, me[2] - v[2] * 0.4];
  let fooled = 0;
  for (let k = 0; k < g.nm; k++) {
    const o = k * MS;
    if (core.M[o + 9] !== 0 || core.M[o + 10] !== 1) continue;
    const m = [core.M[o], core.M[o + 1], core.M[o + 2]];
    if (Math.random() < decoyChance(len(sub(me, m)))) { core.M[o + 9] = -1; core.M.set(norm(sub(at, m)), o + 3); fooled++; }
  }
  g.events.push({ type: 'flare', pos: me, vel: v, fooled });
}
function countChasing() { let n = 0; for (let k = 0; k < g.nm; k++) if (core.M[k * MS + 9] === 0 && core.M[k * MS + 10] === 1) n++; return n; }

function step(dt, input) {
  const spec = waveSpec(g.waves.wave);
  g.t += dt;
  // The player: fly toward the aim, as in the base game.
  if (alive(0)) {
    x.steer(0, ...input.aim);
    const bump = turbulence(g.t, 0, atmos.turbulence); // storms throw the jet about
    x.fly(0, core.OUT[0] + bump.pitch, (input.roll || core.OUT[1]) + bump.roll, core.OUT[2], input.throttle, dt);
  }
  g.cool -= dt;
  if (input.fire && alive(0) && g.ammo > 0 && g.cool <= 0) { g.nb = x.fire(0, 0.004, g.nb); g.ammo--; g.shots++; g.cool = FIRE_RATE; g.events.push({ type: 'cannon' }); }
  // Lock: inside the cone, in range (shorter in rain), and not hidden by cloud.
  const cand = alive(0) ? x.lockable(0, g.np, NC, 0.35, atmos.lockRange) : -1;
  g.lockT = cand >= 0 && cand === g.lock ? g.lockT + dt : 0; g.lock = cand;
  if (cand >= 0 && (g.beep -= dt) <= 0) { g.events.push({ type: 'tick' }); g.beep = g.lockT > 1 ? 0.12 : 0.35; }
  if (input.missile && alive(0) && g.msl > 0) { g.nm = x.launch(0, cand, 2.4, g.nm); g.msl--; g.events.push({ type: 'missile' }); }
  g.flareCool -= dt;
  if (input.flare && alive(0) && g.flares > 0 && g.flareCool <= 0) dropFlares();

  for (let i = 1; i < g.np; i++) if (alive(i)) { pilot(i, spec, dt); if (P[i * PS + 1] < x.ground(P[i * PS], P[i * PS + 2]) + 3) destroy(i); }

  g.nb = x.stepBullets(g.nb, g.np, dt);
  g.nm = x.stepMissiles(g.nm, g.np, NC, dt);
  for (const h of core.hitList()) {
    const i = h.plane, o = i * PS + 14;
    if (!i) { P[o] -= h.kind ? 45 : 3.5; g.events.push({ type: 'struck', heavy: !!h.kind }); }
    else { P[o] -= h.kind ? 80 : 7; if (!h.kind) { g.hits++; g.events.push({ type: 'spark', pos: h.pos }); if (Math.random() < 0.3) g.brains[i].evadeUntil = g.t + 1.5; } }
    if (P[o] <= 0) destroy(i, h.kind ? 'A missile got you' : 'Shot down');
  }

  // Wrecks fall, spinning, then vanish.
  for (let i = 0; i < g.np; i++) {
    const b = g.brains[i];
    if (alive(i) || !(b.wreck > 0)) continue;
    b.wreck -= dt; P[i * PS + 18] = b.wreck; P[i * PS + 8] -= 40 * dt; // slot 18: wreck time left, for the renderer
    for (let k = 0; k < 3; k++) P[i * PS + k] += P[i * PS + 7 + k] * dt;
    const o = i * PS + 3, h = b.spin * dt / 2, s = Math.sin(h), c = Math.cos(h), [qx, qy, qz, qw] = P.subarray(o, o + 4);
    P.set([qx * c + qy * s, qy * c - qx * s, qz * c + qw * s, qw * c - qz * s], o);
  }

  if (!g.over) {
    const me = pos(0);
    g.outT = Math.hypot(me[0], me[2]) > ARENA || me[1] > CEILING ? g.outT + dt : 0;
    if (me[1] < x.ground(me[0], me[2]) + 3) destroy(0, 'You flew into the ground');
    else if (g.outT > 12) destroy(0, 'Left the combat area');
    const low = me[1] - x.ground(me[0], me[2]) < 150 && fwd(0)[1] < 0;
    if ((low || g.outT > 0 || countChasing()) && (g.warnT -= dt) <= 0) { g.events.push({ type: 'alarm' }); g.warnT = 1; }
    let left = 0; for (let i = 1; i < g.np; i++) left += alive(i);
    const { state, event } = stepWaves(g.waves, dt, g.waves.phase === 'fight' ? left : 0);
    if (event === 'spawn') spawn();
    if (event === 'cleared') {
      g.cleared++;
      P[14] = Math.min(100, P[14] + REFIT.hp); g.ammo = REFIT.ammo; g.msl = REFIT.missiles; g.flares = flaresFor(g.waves.wave + 1);
      g.events.push({ type: 'cleared', n: g.waves.wave });
    }
    if (state.wave !== g.waves.wave) g.events.push({ type: 'wave', n: state.wave });
    g.waves = state;
  }
}

function snapshot() {
  let left = 0; const hidden = [];
  for (let i = 1; i < g.np; i++) if (alive(i)) { left++; if (x.cloudAt(i, NC) >= 0 || !x.sight(0, i, NC)) hidden.push(i); }
  const planes = P.slice(0, g.np * PS), bullets = core.B.slice(0, g.nb * BS), missiles = core.M.slice(0, g.nm * MS);
  const msg = {
    type: 'state', np: g.np, planes, nb: g.nb, bullets, nm: g.nm, missiles, events: g.events,
    hud: { wave: g.waves.wave, maxHp: waveSpec(g.waves.wave).hp, phase: g.waves.phase, phaseT: g.waves.t, kills: g.kills, left, t: g.t, ammo: g.ammo, msl: g.msl, flares: g.waves.wave >= FLARES.fromWave ? g.flares : null, lock: g.lock, lockT: g.lockT, outT: g.outT, hidden, incoming: countChasing(), inCloud: x.cloudAt(0, NC) >= 0, over: g.over },
  };
  g.events = [];
  postMessage(msg, [planes.buffer, bullets.buffer, missiles.buffer]);
}

onmessage = async ({ data }) => {
  await ready;
  if (data.atmos) atmos = atmosphere(data.atmos.time, data.atmos.weather);
  if (data.type === 'start') { x.seedRandom(data.seed >>> 0); newGame(); snapshot(); }
  else if (data.type === 'step' && g) {
    // Fixed steps of at most 1/60 s, so a slow frame never tunnels a bullet through a plane.
    const n = Math.max(1, Math.ceil(data.dt * 60 - 1e-6)), dt = data.dt / n;
    for (let k = 0; k < n; k++) step(dt, k ? { ...data.input, missile: false, flare: false } : data.input);
    snapshot();
  } else if (data.type === 'clear' && g) { for (let i = 1; i < g.np; i++) if (alive(i)) { P[i * PS + 14] = 0; destroy(i); } } // the benchmark's shortcut through a wave
};
