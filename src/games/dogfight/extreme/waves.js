// Extreme mode's rules, with no rendering and no three.js, so the worker and node --test can both use
// them: the wave ladder, the cloud field, when an enemy hides or fires a missile, and the score.
// Units are metres and seconds; points are [x, y, z].

// The ladder: guns only → homing missiles → more of them → they hide in clouds. Past wave 4 every
// wave adds a jet and sharper pilots, up to a cap.
export function waveSpec(n) {
  const past = Math.max(0, n - 4);
  return {
    n,
    count: n < 3 ? 3 : Math.min(10, 5 + past),
    missiles: n < 2 ? 0 : n < 5 ? 1 : 2, // per enemy
    hide: n >= 4,
    skill: Math.min(0.95, 0.35 + (n - 1) * 0.07),
    hp: 60 + Math.min(40, past * 5),
  };
}

// The banner's second line: what's new this wave.
export const waveNews = (n) => ['Guns only', 'They carry homing missiles', 'More of them', 'They hide in the clouds'][n - 1] ?? `${waveSpec(n).count} bandits, sharper pilots`;

// Between waves: a banner and a breather, then the next wave spawns.
export const BANNER = 3, BREATHER = 2.5;

// One wave-machine step. state: { wave, phase: 'banner' | 'fight' | 'clear', t }.
// Returns the new state and what happened ('spawn' when a wave's jets should appear, 'cleared').
export function stepWaves(s, dt, alive) {
  const t = s.t + dt;
  if (s.phase === 'banner') return t >= BANNER ? { state: { ...s, phase: 'fight', t: 0 }, event: 'spawn' } : { state: { ...s, t } };
  if (s.phase === 'fight') return alive === 0 ? { state: { ...s, phase: 'clear', t: 0 }, event: 'cleared' } : { state: { ...s, t } };
  return t >= BREATHER ? { state: { wave: s.wave + 1, phase: 'banner', t: 0 } } : { state: { ...s, t } };
}
export const firstWave = () => ({ wave: 1, phase: 'banner', t: 0 });

// A fixed, seeded cloud field: the renderer draws it and the worker tests sight lines against it.
export function cloudField(count = 44, arena = 4000, seed = 7) {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const out = [];
  while (out.length < count) {
    const x = (r() - 0.5) * arena * 1.7, z = (r() - 0.5) * arena * 1.7;
    const c = { x, y: 650 + r() * 650, z, r: 120 + r() * 110 };
    // Keep them apart so each is a distinct place to hide, and clear of the player's start.
    if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > o.r + c.r + 150) && Math.hypot(c.x, c.z + 2600) > 500) out.push(c);
  }
  return out;
}

export const inside = (p, c, k = 1) => (p[0] - c.x) ** 2 + (p[1] - c.y) ** 2 + (p[2] - c.z) ** 2 < (c.r * k) ** 2;

// The cloud an enemy should run to: the nearest one on its side away from the player (any, if none is).
export function hideSpot(pos, player, clouds) {
  let best = null, bd = Infinity;
  for (const c of clouds) {
    const toward = (c.x - pos[0]) * (player[0] - pos[0]) + (c.z - pos[2]) * (player[2] - pos[2]) > 0;
    const d = Math.hypot(c.x - pos[0], c.y - pos[1], c.z - pos[2]) + (toward ? 1e6 : 0);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// From wave 4 a pilot runs for cloud when hurt, locked or chased; it stays hidden a while, then comes out.
export const shouldHide = (spec, { hpFrac, threatened }) => spec.hide && (hpFrac < 0.6 || threatened);
export const HIDE_TIME = 6, HIDE_COOLDOWN = 9;

// An enemy launches when it has missiles, the player is ahead and in range, it can see them,
// its launcher has cooled, and not too many missiles are already chasing the player.
export const ENEMY_MSL = { minRange: 350, maxRange: 1700, cone: 0.4, cooldown: 7, inFlight: 2 };
export function canLaunch(spec, { left, dist, angle, sight, cooldown, chasing }) {
  return spec.missiles > 0 && left > 0 && dist > ENEMY_MSL.minRange && dist < ENEMY_MSL.maxRange
    && angle < ENEMY_MSL.cone && sight && cooldown <= 0 && chasing < ENEMY_MSL.inFlight;
}

// Each cleared wave tops you up a little.
export const REFIT = { hp: 30, ammo: 600, missiles: 4 };

export function extremeScore({ kills, waves, shots, hits, hp }) {
  const accuracy = shots ? hits / shots : 0;
  return Math.round(kills * 400 + waves * 1500 + accuracy * 2000 + Math.max(0, hp) * 10);
}
