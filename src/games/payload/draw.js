import { W, H, PLANE_X, CEIL, GROUND } from './sim.js';

// Payload Run's look: a sky that turns from day to dusk to night as you fly further, layered parallax
// (mountains, a city skyline, clouds, near hills, the airfield), lattice pylons, the red-and-white 038,
// and particles for exhaust, pickups and the crash. Pure canvas; everything procedural.

const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Palette keyframes: day → dusk → night.
const PAL = {
  top: ['#4f9de6', '#3a3c78', '#060a1c'],
  bottom: ['#cbe8ff', '#ff9a6a', '#1a2550'],
  far: ['#8db3c9', '#6b5b8c', '#1b2442'],
  city: ['#7a90a6', '#463f63', '#121a31'],
  cloud: ['#ffffff', '#ffc9a8', '#3a4670'],
  near: ['#4c8758', '#3b4c47', '#0d1820'],
  ground: ['#5b9a4a', '#3c5638', '#122016'],
  steel: ['#c8ced6', '#9a96ad', '#566079'],
};
const col = (key, p) => (p < 1 ? mix(PAL[key][0], PAL[key][1], p) : mix(PAL[key][1], PAL[key][2], p - 1));

export const phaseAt = (dist) => clamp(dist / 10 / 1000, 0, 2); // 0 day, 1 dusk (1 km), 2 night (2 km)

export function createFx() {
  return { parts: [], floaters: [], shake: 0, wind: Array.from({ length: 14 }, (_, i) => ({ x: hash(i) * W, y: CEIL + hash(i + 50) * (GROUND - CEIL), l: 40 + hash(i + 9) * 80 })) };
}

export function applyEvents(fx, events, s) {
  for (const e of events) {
    if (e.type === 'pickup') {
      const c = e.kind === 'crate' ? '#f2b544' : '#5fe39a';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, v = 2 + hash(i + s.dist) * 3;
        fx.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, size: 3, c, g: 0 });
      }
      // The reward flies to the HUD along an arc, not a straight line.
      fx.floaters.push({ x0: e.x, y0: e.y, t: 0, text: e.kind === 'crate' ? '+0.5 kg' : '+charge', c });
    } else if (e.type === 'crash') {
      fx.shake = 16;
      for (let i = 0; i < 46; i++) {
        const a = hash(i * 3.1) * Math.PI * 2, v = 2 + hash(i * 7.7) * 7;
        fx.parts.push({ x: PLANE_X, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, size: 2 + hash(i) * 4, c: ['#e23a46', '#f5f5f2', '#3a3f47', '#ffb347'][i % 4], g: 0.18 });
      }
    }
  }
}

function sky(ctx, p, t) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, col('top', p)); g.addColorStop(1, col('bottom', p));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Stars fade in after dusk.
  const night = clamp(p - 1.1);
  if (night > 0) {
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(t / 900 + i)));
      ctx.fillStyle = '#fff';
      ctx.fillRect(hash(i) * W, hash(i + 200) * (GROUND - 120), 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  // The sun sinks through dusk; the moon rises after it.
  const sunY = 70 + clamp(p) * (GROUND - 110), sunC = p < 1 ? mix('#fff6cf', '#ffb26b', p) : '#ffb26b';
  if (p < 1.3) {
    const glow = ctx.createRadialGradient(760, sunY, 10, 760, sunY, 120);
    glow.addColorStop(0, sunC); glow.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.globalAlpha = clamp(1.3 - p); ctx.fillStyle = glow; ctx.fillRect(600, sunY - 130, 320, 260);
    ctx.fillStyle = sunC; ctx.beginPath(); ctx.arc(760, sunY, 26, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (night > 0) {
    ctx.globalAlpha = night; ctx.fillStyle = '#e9edff';
    ctx.beginPath(); ctx.arc(820, 90, 18, 0, 7); ctx.fill();
    ctx.fillStyle = col('top', p); ctx.beginPath(); ctx.arc(828, 84, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
}

// A ridge line made of a few sines, scrolled at a fraction of flight speed.
function ridge(ctx, dist, speed, base, amp, color, seed) {
  const off = dist * speed;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W + 20; x += 20) {
    const u = (x + off) / 160;
    ctx.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(u + seed) + 0.2 * Math.sin(u * 2.3 + seed * 2) + 0.1 * Math.sin(u * 5.1)));
  }
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
}

function city(ctx, dist, p) {
  const off = dist * 0.22, night = clamp(p - 0.9);
  const first = Math.floor(off / 56) - 1;
  for (let i = first; i < first + W / 56 + 3; i++) {
    const w = 34 + hash(i) * 30, h = 40 + hash(i + 17) * 120, x = i * 56 - off, y = GROUND - 26 - h;
    ctx.fillStyle = col('city', p); ctx.fillRect(x, y, w, h + 26);
    if (hash(i + 5) > 0.75) { ctx.fillRect(x + w / 2 - 1, y - 16, 2, 16); } // antenna
    if (night > 0) {
      ctx.fillStyle = `rgba(255,214,130,${0.85 * night})`;
      for (let r = 0; r < h / 12 - 1; r++) for (let c = 0; c < w / 9 - 1; c++) {
        if (hash(i * 31 + r * 7 + c) > 0.62) ctx.fillRect(x + 4 + c * 9, y + 6 + r * 12, 4, 5);
      }
    }
  }
}

function clouds(ctx, dist, p) {
  ctx.fillStyle = col('cloud', p);
  for (let i = 0; i < 7; i++) {
    const span = W + 360, x = ((hash(i) * span - dist * (0.3 + hash(i + 3) * 0.15)) % span + span) % span - 180;
    const y = 70 + hash(i + 11) * 170, s = 0.7 + hash(i + 21) * 0.8;
    ctx.globalAlpha = p > 1.5 ? 0.35 : 0.85;
    for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 32], [60, 0, 24], [30, 8, 26]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function ground(ctx, dist, p) {
  const g = ctx.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, col('ground', p)); g.addColorStop(1, mix('#2a3a22', '#070c08', clamp(p / 2)));
  ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
  // Runway edge markers and fence posts at full speed.
  const off = dist % 60;
  ctx.fillStyle = p > 1.4 ? '#ffcf6b' : '#f4f1e8';
  for (let x = -off; x < W; x += 60) ctx.fillRect(x, GROUND + 16, 26, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = -(dist % 34); x < W; x += 34) ctx.fillRect(x, GROUND + 2, 2, 8);
}

function pylon(ctx, it, p, t) {
  const steel = col('steel', p);
  ctx.strokeStyle = steel; ctx.lineWidth = 2;
  for (const [a, b] of [[CEIL, it.top], [it.top + it.gap, GROUND]]) {
    ctx.beginPath(); ctx.moveTo(it.x, a); ctx.lineTo(it.x, b); ctx.moveTo(it.x + it.w, a); ctx.lineTo(it.x + it.w, b); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = a; y < b - 2; y += 18) { ctx.moveTo(it.x, y); ctx.lineTo(it.x + it.w, Math.min(b, y + 18)); ctx.moveTo(it.x + it.w, y); ctx.lineTo(it.x, Math.min(b, y + 18)); }
    ctx.stroke(); ctx.lineWidth = 2;
  }
  // Warning lights at the edges of the gap, blinking.
  const on = Math.sin(t / 180) > 0;
  for (const y of [it.top, it.top + it.gap]) {
    ctx.fillStyle = on ? '#ff3b3b' : '#7a1c1c';
    if (on) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 14; }
    ctx.beginPath(); ctx.arc(it.x + it.w / 2, y, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
}

function pickup(ctx, it, t) {
  const bob = Math.sin(t / 260 + it.x / 50) * 3, x = it.x, y = it.y + bob;
  if (it.kind === 'crate') {
    ctx.fillStyle = '#b97a3a'; ctx.fillRect(x - 11, y - 11, 22, 22);
    ctx.strokeStyle = '#6e4420'; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 11, 22, 22);
    ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11); ctx.stroke();
    ctx.fillStyle = '#f2b544'; ctx.font = '700 8px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('kg', x + 6, y - 3); ctx.textAlign = 'left';
  } else {
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
    glow.addColorStop(0, 'rgba(95,227,154,0.55)'); glow.addColorStop(1, 'rgba(95,227,154,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 26, y - 26, 52, 52);
    ctx.fillStyle = '#20262e'; ctx.fillRect(x - 7, y - 12, 14, 24); ctx.fillRect(x - 3, y - 15, 6, 3);
    ctx.fillStyle = '#5fe39a'; ctx.fillRect(x - 5, y - 2 + Math.sin(t / 200) * 2, 10, 12);
  }
}

// The 038, side view, nose right; pitched with its climb rate. Spinning prop, tail number.
function plane(ctx, s, t) {
  ctx.save(); ctx.translate(PLANE_X, s.y); ctx.rotate(clamp(s.vy / 14, -0.5, 0.5)); ctx.scale(1.15, 1.15);
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f242b'; ctx.lineWidth = 1.2;
  // Tail plane and fin.
  ctx.fillStyle = '#c41e2c';
  ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(-44, -20); ctx.lineTo(-36, -20); ctx.lineTo(-26, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e9ecef'; ctx.fillRect(-46, -1, 16, 3);
  // Fuselage.
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9ced6');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(36, 1); ctx.quadraticCurveTo(34, -8, 16, -8); ctx.lineTo(-40, -3); ctx.lineTo(-40, 2); ctx.lineTo(14, 7); ctx.quadraticCurveTo(32, 8, 36, 1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c41e2c'; // nose cowl and cheat line
  ctx.beginPath(); ctx.moveTo(36, 1); ctx.quadraticCurveTo(34, -8, 24, -8); ctx.lineTo(24, 7.5); ctx.quadraticCurveTo(32, 8, 36, 1); ctx.fill();
  ctx.fillRect(-30, -1, 50, 2.2);
  ctx.fillStyle = '#7fc4ff'; ctx.beginPath(); ctx.moveTo(14, -7.5); ctx.lineTo(6, -7.5); ctx.lineTo(8, -3); ctx.lineTo(17, -3); ctx.closePath(); ctx.fill(); // window
  // High wing, end on, with strut.
  ctx.fillStyle = '#c41e2c'; ctx.beginPath(); ctx.roundRect(-6, -13, 30, 5, 2.5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(0, 5); ctx.stroke();
  // Gear.
  ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(21, 15); ctx.moveTo(-2, 5); ctx.lineTo(-4, 13); ctx.stroke();
  ctx.fillStyle = '#1f242b'; for (const [x, y] of [[21, 16], [-4, 14]]) { ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); }
  // Tail number.
  ctx.fillStyle = '#1f242b'; ctx.font = '700 6px "IBM Plex Mono", monospace'; ctx.fillText('038', -36, -9);
  // Propeller: a blurred disc and one blade catching the light.
  ctx.fillStyle = 'rgba(210,214,220,0.35)'; ctx.beginPath(); ctx.ellipse(38, 1, 2.2, 13, 0, 0, 7); ctx.fill();
  const b = Math.sin(t / 16) * 12; ctx.strokeStyle = '#2b3038'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(38, 1 - b); ctx.lineTo(38, 1 + b); ctx.stroke();
  ctx.restore();
}

function hud(ctx, s, best, k, p) {
  const ink = p > 1.2 ? '#e9edf5' : '#16181b';
  ctx.font = `600 ${14 * k}px "IBM Plex Mono", monospace`; ctx.textBaseline = 'top';
  ctx.fillStyle = p > 1.2 ? 'rgba(8,12,24,0.55)' : 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.roundRect(12, 10, 340 * k, 28 * k, 6); ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(`${String(Math.floor(s.dist / 10)).padStart(5, '0')} m`, 22, 16);
  ctx.fillText(`${s.kg.toFixed(1)} kg`, 22 + 100 * k, 16);
  // Battery: ten segments, green → amber → red.
  const bx = 22 + 190 * k, seg = 13 * k;
  for (let i = 0; i < 10; i++) {
    const lit = s.battery > i / 10;
    ctx.fillStyle = lit ? (s.battery < 0.2 ? '#ff4b55' : s.battery < 0.45 ? '#ffb547' : '#3fd486') : 'rgba(127,127,127,0.35)';
    ctx.fillRect(bx + i * seg, 17, seg - 3, 14 * k - 6);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = ink; ctx.fillText(`BEST ${best}`, W - 20, 16); ctx.textAlign = 'left';
}

export function draw(ctx, s, fx, t, k, best) {
  const p = phaseAt(s.dist);
  ctx.save();
  if (fx.shake > 0.3) { ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake); fx.shake *= 0.9; }
  sky(ctx, p, t);
  ridge(ctx, s.dist, 0.06, GROUND - 120, 150, col('far', p), 1);
  city(ctx, s.dist, p);
  clouds(ctx, s.dist, p);
  ridge(ctx, s.dist, 0.5, GROUND - 10, 60, col('near', p), 4);
  ground(ctx, s.dist, p);
  // Altitude ceiling.
  ctx.strokeStyle = 'rgba(255,80,90,0.6)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, CEIL); ctx.lineTo(W, CEIL); ctx.stroke(); ctx.setLineDash([]);
  // Wind streaks, faster than the scenery.
  ctx.strokeStyle = p > 1.2 ? 'rgba(200,215,255,0.18)' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
  for (const w of fx.wind) {
    if (!s.over) w.x -= s.speed * 2.2;
    if (w.x + w.l < 0) { w.x = W + Math.random() * 200; w.y = CEIL + Math.random() * (GROUND - CEIL); }
    ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + w.l, w.y); ctx.stroke();
  }
  for (const it of s.items) if (it.kind === 'pylon') pylon(ctx, it, p, t); else if (!it.got) pickup(ctx, it, t);
  // Exhaust puffs while flying.
  if (!s.over && Math.random() < 0.6) fx.parts.push({ x: PLANE_X - 44, y: s.y + 1, vx: -s.speed * 0.6, vy: (Math.random() - 0.5) * 0.4, life: 0.7, size: 2.5, c: p > 1.2 ? '#8892a8' : '#ffffff', g: 0, puff: true });
  if (!s.over) plane(ctx, s, t);
  for (const q of fx.parts) {
    q.x += q.vx; q.y += q.vy; q.vy += q.g; q.life -= q.puff ? 0.03 : 0.018;
    ctx.globalAlpha = clamp(q.life); ctx.fillStyle = q.c;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.puff ? q.size * (2 - q.life) : q.size, 0, 7); ctx.fill();
  }
  fx.parts = fx.parts.filter((q) => q.life > 0);
  ctx.globalAlpha = 1;
  // Pickup rewards arc up to the payload readout.
  for (const f of fx.floaters) {
    f.t += 0.03;
    const u = clamp(f.t), x = f.x0 + (130 - f.x0) * u, y = f.y0 + (24 - f.y0) * u - Math.sin(u * Math.PI) * 60;
    ctx.globalAlpha = 1 - u * 0.6; ctx.fillStyle = f.c; ctx.font = `700 ${14 * k}px "IBM Plex Mono", monospace`;
    ctx.fillText(f.text, x, y);
  }
  fx.floaters = fx.floaters.filter((f) => f.t < 1);
  ctx.globalAlpha = 1;
  hud(ctx, s, best, k, p);
  ctx.restore();
}
