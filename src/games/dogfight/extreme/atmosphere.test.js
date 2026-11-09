import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atmosphere, TIMES, WEATHERS, turbulence, nextStrike, thunderDelay } from './atmosphere.js';

test('every time and weather has a look and rules', () => {
  for (const t of TIMES) for (const w of WEATHERS) {
    const a = atmosphere(t, w);
    assert.ok(a.fog[0] < a.fog[1] && a.lockRange > 0 && /^#[0-9a-f]{6}$/.test(a.background), `${t} ${w}`);
  }
});
test('night is dark, clear days get the physical sky, stars only on clear nights', () => {
  const day = atmosphere('day', 'clear'), night = atmosphere('night', 'clear');
  assert.ok(day.sky && !night.sky && night.sun < day.sun / 10 && night.hemi < day.hemi / 10);
  assert.ok(night.stars && !atmosphere('night', 'rain').stars && !day.stars);
});
test('worse weather: closer fog, shorter seeker range, more rain, rougher air; lightning only in storms', () => {
  const [c, r, s] = WEATHERS.map((w) => atmosphere('day', w));
  assert.ok(c.fog[1] > r.fog[1] && r.fog[1] > s.fog[1]);
  assert.ok(c.lockRange > r.lockRange && r.lockRange > s.lockRange);
  assert.ok(c.rain === 0 && r.rain > 0 && s.rain > r.rain);
  assert.ok(c.turbulence === 0 && s.turbulence > r.turbulence);
  assert.deepEqual([c.lightning, r.lightning, s.lightning], [false, false, true]);
});
test('turbulence stays within its strength and differs per plane; thunder lags the flash', () => {
  for (let t = 0; t < 20; t += 0.37) { const b = turbulence(t, 2, 0.2); assert.ok(Math.abs(b.pitch) <= 0.2 && Math.abs(b.roll) <= 0.2); }
  assert.notDeepEqual(turbulence(5, 1, 0.2), turbulence(5, 2, 0.2));
  assert.deepEqual(turbulence(5, 1, 0), { pitch: 0, roll: 0 });
  assert.ok(nextStrike(0) >= 3 && nextStrike(1) <= 11);
  assert.ok(Math.abs(thunderDelay(3430) - 10) < 1e-9);
});
