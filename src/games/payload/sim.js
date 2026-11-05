// Payload Run: the game itself, with no drawing and no DOM, so it can be tested on its own.
// Hold to climb (drains the battery), let go to sink (recharges a little). Collect crates for payload,
// cells for charge; pylons, the ground and the altitude ceiling end the flight.
// Units: px on a 960×540 field, dt in 60 fps frames. step() also leaves s.events for sound and effects.
export const W = 960, H = 540, PLANE_X = 220, CEIL = 40, GROUND = H - 48;

export function fresh() {
  return { y: H / 2, vy: 0, dist: 0, speed: 4.2, kg: 0, battery: 1, items: [], next: 60, gust: 0, over: false, events: [] };
}

// Pylons come in pairs with a gap; crates and cells float in the gaps and between them.
function spawn(s, rand) {
  const gap = Math.max(150, 230 - s.dist / 400);
  const top = CEIL + 30 + rand() * (GROUND - CEIL - gap - 60);
  s.items.push({ kind: 'pylon', x: W + 40, top, gap, w: 26 });
  s.items.push({ kind: rand() < 0.28 ? 'cell' : 'crate', x: W + 53, y: top + gap / 2, r: 13 });
  if (rand() < 0.5) s.items.push({ kind: 'crate', x: W + 240, y: CEIL + 60 + rand() * (GROUND - CEIL - 120), r: 13 });
  s.next = Math.max(70, 120 - s.dist / 300);
}

export function step(s, hold, dt, rand = Math.random) {
  s.events = [];
  if (s.over) return s;
  const up = hold && s.battery > 0;
  s.vy += (up ? -0.55 : 0.38) * dt + s.gust * dt;
  s.vy = Math.max(-7, Math.min(8, s.vy)) * 0.985;
  s.y += s.vy * dt;
  s.battery = Math.max(0, Math.min(1, s.battery - (up ? 0.0035 : -0.0006) * dt));
  s.speed = 4.2 + s.dist / 4000;
  s.dist += s.speed * dt;
  if (rand() < 0.01) s.gust = (rand() - 0.5) * 0.25;
  s.gust *= 0.99;
  for (const it of s.items) it.x -= s.speed * dt;
  s.items = s.items.filter((it) => it.x > -80);
  if ((s.next -= (s.speed * dt) / 4.2) <= 0) spawn(s, rand);
  for (const it of s.items) {
    if (it.kind === 'pylon') {
      const inX = PLANE_X + 34 > it.x && PLANE_X - 38 < it.x + it.w;
      if (inX && (s.y - 8 < it.top || s.y + 8 > it.top + it.gap)) s.over = 'Clipped a pylon';
    } else if (!it.got && Math.hypot(it.x - PLANE_X, it.y - s.y) < it.r + 18) {
      it.got = true;
      if (it.kind === 'crate') s.kg += 0.5;
      else s.battery = Math.min(1, s.battery + 0.35);
      s.events.push({ type: 'pickup', kind: it.kind, x: it.x, y: it.y });
    }
  }
  if (!s.over && s.y + 14 > GROUND) s.over = 'Hit the ground';
  if (!s.over && s.y - 10 < CEIL) s.over = 'Broke the altitude ceiling';
  if (s.over) s.events.push({ type: 'crash', why: s.over });
  return s;
}

export const score = (s) => Math.floor(s.dist / 10 + s.kg * 50);
