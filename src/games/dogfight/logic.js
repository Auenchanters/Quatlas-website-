import { Quaternion, Vector3 } from 'three';

// Dogfight's rules, with no rendering: arcade flight, mouse-aim steering, the enemy pilots, guns,
// missiles, terrain and scoring. Units are metres and seconds. Plane axes: forward +Z, up +Y, right −X.
export const FWD = new Vector3(0, 0, 1), UP = new Vector3(0, 1, 0), RIGHT = new Vector3(-1, 0, 0);
export const ARENA = 4000, CEILING = 3000, BULLET_SPEED = 900, BULLET_LIFE = 1.6;
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const _q = new Quaternion(), _v = new Vector3(), _w = new Vector3();

// Islands out of a sea: a few sines, the same function builds the mesh and checks crashes.
export function heightAt(x, z) {
  const h = 220 * Math.sin(x * 0.0011 + 1.3) * Math.cos(z * 0.0013 - 0.4)
    + 120 * Math.sin(x * 0.0031 - z * 0.0022 + 2.1)
    + 45 * Math.sin(x * 0.009 + 0.7) * Math.sin(z * 0.011 + 2.9)
    - 60;
  return Math.max(-20, h); // the sea floor; the water itself sits at y = 0
}
export const groundAt = (x, z) => Math.max(0, heightAt(x, z));

// agility scales the turn rates: the player out-turns the enemies a little, as arcade games do.
export function createPlane({ pos = new Vector3(0, 900, 0), quat = new Quaternion(), speed = 140, hp = 100, team = 'red', min = 60, max = 190, agility = 1 } = {}) {
  return { pos: pos.clone(), quat: quat.clone(), vel: new Vector3(), speed, hp, maxHp: hp, team, min, max, agility, alive: true, cooldown: 0, smoke: 0 };
}
export const forwardOf = (p, out = new Vector3()) => out.copy(FWD).applyQuaternion(p.quat);
export const upOf = (p, out = new Vector3()) => out.copy(UP).applyQuaternion(p.quat);

// input: pitch (nose up +), roll (right wing down +), yaw (nose right +), throttle 0..1; all −1..1.
export const RATES = { pitch: 1.5, roll: 3.2, yaw: 0.55 };
export function fly(p, input, dt) {
  _q.setFromAxisAngle(RIGHT, clamp(input.pitch) * RATES.pitch * p.agility * dt); p.quat.multiply(_q);
  _q.setFromAxisAngle(FWD, clamp(input.roll) * RATES.roll * p.agility * dt); p.quat.multiply(_q);
  _q.setFromAxisAngle(UP, -clamp(input.yaw) * RATES.yaw * p.agility * dt); p.quat.multiply(_q);
  p.quat.normalize();
  const f = forwardOf(p, _v);
  // Throttle sets the target speed; climbing bleeds speed, diving gains it.
  const target = p.min + clamp(input.throttle, 0, 1) * (p.max - p.min) - f.y * 40;
  p.speed += (target - p.speed) * Math.min(1, dt * 0.8);
  p.speed = clamp(p.speed, p.min * 0.8, p.max * 1.2);
  p.vel.copy(f).multiplyScalar(p.speed);
  p.pos.addScaledVector(p.vel, dt);
  return p;
}

// Turns "fly toward this direction" into stick inputs: bank toward the target and pull, or, when the
// target is nearly on the nose, nudge with pitch and yaw and level the wings.
export function steerToward(p, dir) {
  const l = _v.copy(dir).normalize().applyQuaternion(_q.copy(p.quat).invert());
  const off = Math.acos(clamp(l.z));
  const bank = Math.atan2(-l.x, l.y); // 0 when the target is straight up, +π/2 when it is to the right
  const right = _w.copy(RIGHT).applyQuaternion(p.quat);
  const level = clamp(right.y * 2);
  const roll = off > 0.25 ? clamp(bank * 1.6) : level * (1 - off / 0.25) + clamp(bank * 1.6) * (off / 0.25);
  return { pitch: clamp(l.y * 3 + (off > 1.2 ? 0.8 : 0), -1, 1), roll, yaw: clamp(-l.x * 2.5) };
}

// Where to aim so a bullet meets a target flying at constant velocity (a few refinement passes).
export function leadPoint(from, targetPos, targetVel, speed = BULLET_SPEED, out = new Vector3()) {
  out.copy(targetPos);
  for (let i = 0; i < 4; i++) { const t = from.distanceTo(out) / speed; out.copy(targetPos).addScaledVector(targetVel, t); }
  return out;
}

// Does the segment a→b pass within r of c?
export function hitSphere(a, b, c, r) {
  const ab = _v.copy(b).sub(a), len2 = ab.lengthSq();
  const t = len2 ? clamp(_w.copy(c).sub(a).dot(ab) / len2, 0, 1) : 0;
  return _w.copy(a).addScaledVector(ab, t).distanceToSquared(c) <= r * r;
}

export function fireBullet(p, owner, spread = 0, rand = Math.random) {
  const dir = forwardOf(p, new Vector3());
  if (spread) dir.add(new Vector3((rand() - 0.5) * spread, (rand() - 0.5) * spread, (rand() - 0.5) * spread)).normalize();
  return { pos: p.pos.clone().addScaledVector(dir, 12), vel: dir.multiplyScalar(BULLET_SPEED).add(p.vel), life: BULLET_LIFE, owner };
}

// Moves bullets; returns [{ bullet, plane }] for every hit (the bullet is spent).
export function stepBullets(bullets, planes, dt) {
  const hits = [];
  for (const b of bullets) {
    if (b.life <= 0) continue; // spent: it already hit something or timed out
    const a = b.pos.clone();
    b.pos.addScaledVector(b.vel, dt);
    b.life -= dt;
    for (const p of planes) {
      if (!p.alive || p.team === b.owner) continue;
      if (hitSphere(a, b.pos, p.pos, 9)) { hits.push({ bullet: b, plane: p }); b.life = 0; break; }
    }
  }
  return hits;
}

// A missile turns toward where its target will be, up to a limited rate, and arms after 0.25 s.
export function createMissile(p, target) {
  return { pos: p.pos.clone().addScaledVector(upOf(p, new Vector3()), -3), dir: forwardOf(p, new Vector3()), speed: p.speed + 60, target, life: 6, age: 0 };
}
export function stepMissile(m, dt) {
  m.age += dt; m.life -= dt;
  m.speed = Math.min(420, m.speed + 260 * dt);
  if (m.target?.alive) {
    const aim = leadPoint(m.pos, m.target.pos, m.target.vel, m.speed, new Vector3()).sub(m.pos).normalize();
    const ang = m.dir.angleTo(aim), max = 2.4 * dt;
    if (ang > 1e-4) m.dir.lerp(aim, Math.min(1, max / ang)).normalize();
  }
  m.pos.addScaledVector(m.dir, m.speed * dt);
  const hit = m.age > 0.25 && m.target?.alive && m.pos.distanceTo(m.target.pos) < 14;
  if (hit) m.life = 0;
  return hit;
}

// Lock-on: the nearest enemy inside a 20° cone within 1.6 km.
export function lockCandidate(p, enemies) {
  const f = forwardOf(p, new Vector3());
  let best = null, bestD = 1600;
  for (const e of enemies) {
    if (!e.alive) continue;
    const to = _v.copy(e.pos).sub(p.pos), d = to.length();
    if (d < bestD && f.angleTo(to) < 0.35) { best = e; bestD = d; }
  }
  return best;
}

// The enemy pilot. Modes: climb away from the ground, evade when hit or with the player on its tail,
// otherwise pursue the player's lead point and fire when the shot lines up.
export function think(e, player, now, skill = 0.5) {
  const toPlayer = _v.copy(player.pos).sub(e.pos), dist = toPlayer.length();
  const f = forwardOf(e, new Vector3());
  const alt = e.pos.y - groundAt(e.pos.x, e.pos.z);
  const pf = forwardOf(player, new Vector3());
  const playerBehind = dist < 700 && pf.angleTo(toPlayer.clone().negate()) < 0.5 && f.angleTo(toPlayer) > 2.2;
  let mode = 'pursue', aim, fire = false;
  if (alt < 180 || e.pos.y < 120) { mode = 'climb'; aim = f.clone().setY(0).normalize().add(new Vector3(0, 1.4, 0)).normalize(); }
  // A pilot can't break away again straight after a break: a cooldown, longer for weaker pilots.
  else if (now < (e.evadeUntil ?? 0) || (playerBehind && now > (e.evadeReady ?? 0))) {
    mode = 'evade';
    if (!e.evadeDir || now > (e.evadeUntil ?? 0)) { e.evadeUntil = now + 2.5; e.evadeReady = now + 2.5 + 7 * (1 - skill); e.evadeDir = new Vector3().crossVectors(f, UP).multiplyScalar(Math.sign(Math.sin(now * 3.1 + e.pos.x)) || 1).add(new Vector3(0, -0.3, 0)).normalize(); }
    aim = e.evadeDir;
  } else if (e.pos.length() > ARENA * 0.9) { mode = 'return'; aim = e.pos.clone().negate().setY(900 - e.pos.y).normalize(); }
  else if (now < (e.extendUntil ?? 0)) {
    // Extending: run straight out to come back for another pass. This is the player's chance.
    mode = 'extend'; aim = e.extendDir;
  } else {
    aim = leadPoint(e.pos, player.pos, player.vel, BULLET_SPEED, new Vector3()).sub(e.pos).normalize();
    fire = dist < 650 && f.angleTo(aim) < 0.05 + (1 - skill) * 0.05;
    // A long turning fight at close range with no shot: break it off and extend.
    e.knife = dist < 600 && f.angleTo(aim) > 0.6 ? (e.knife ?? 0) + 1 / 60 : 0;
    if (e.knife > 5 - skill * 2) { e.knife = 0; e.extendUntil = now + 4; e.extendDir = f.clone().setY(0.15).normalize(); }
  }
  return { mode, fire, input: { ...steerToward(e, aim), throttle: mode === 'pursue' && dist < 300 ? 0.45 : 0.85 } };
}

export const outOfBounds = (p) => Math.hypot(p.pos.x, p.pos.z) > ARENA || p.pos.y > CEILING;
export const crashed = (p) => p.pos.y < groundAt(p.pos.x, p.pos.z) + 3;

export function finalScore({ kills, time, shots, hits, hp }) {
  const accuracy = shots ? hits / shots : 0;
  return Math.round(kills * 500 + Math.max(0, 3000 - time * 10) * (kills === 4 ? 1 : 0) + accuracy * 2000 + Math.max(0, hp) * 10);
}
