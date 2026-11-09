import { speedColour } from './speed-colour';
import { LAND } from '../content/land';
import { panelBox } from './avionics-panel';

// The animated scenes behind the subteam pages, as plain canvas code with no DOM: they run in a worker on an
// OffscreenCanvas (backdrop.worker.js), or on the page where that isn't possible. A scene is
// { setup(w, h), frame(ctx, w, h, dt, t), onDown?(x, y), onUp?(), hover?(x, y) → cursor }.

// Where the pointer is, and how fast it moves (px/ms): fed from the page's pointer events.
export const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };
export const trackAt = (x, y, now) => { const dt = Math.max(8, now - pointer.t); pointer.vx = (x - pointer.x) / dt; pointer.vy = (y - pointer.y) / dt; pointer.x = x; pointer.y = y; pointer.t = now; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// A scratch canvas (no document in a worker).
const sheet = (w, h) => (typeof document === 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));

// Small canvas helpers shared by the instrument scenes.
const FONT = (px, wt = 600) => `${wt} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
const txt = (ctx, s, x, y, fill, px = 12, align = 'center', wt = 600) => { ctx.font = FONT(px, wt); ctx.fillStyle = fill; ctx.textAlign = align; ctx.fillText(s, x, y); };
const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
const box = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// --- Aerodynamics: a live flow field past a large wing section. The flow is exact potential flow round a
// Joukowski aerofoil with the circulation that makes it leave the trailing edge smoothly (the Kutta
// condition), so it speeds up over the top, slows under it and is turned down behind: that is the lift.
// The cursor's height sets the angle of attack; past the stall the flow over the top breaks up. The cursor
// itself is also a body in the flow. Streaks are coloured by speed.
function aero() {
  let parts = [], fresh = true, G = null;
  const U = 90, Zx = -0.1, Zy = 0.085, A = Math.hypot(1 - Zx, Zy); // circle through ζ = 1, the trailing edge
  const st = { deg: 5, a: 0, gam: 0, stall: 0 };
  const spawn = (p, w, h, anywhere) => { p.x = anywhere ? Math.random() * w : -Math.random() * 40; p.y = Math.random() * h; p.age = 0; p.life = 4 + Math.random() * 6; return p; };
  const setup = (w, h) => {
    parts = Array.from({ length: Math.min(6000, Math.round((w * h) / 300)) }, () => spawn({}, w, h, true));
    fresh = true; // a resize clears the canvas: start from a solid field, not transparent
    const chord = Math.min(w * 0.46, h * 1.1);
    G = { cx: w * 0.64, cy: h * 0.55, S: chord / 4.05 };
  };
  // The circulation Γ for angle a: dW/dζ = e^{-ia} − A²e^{ia}/(ζ−ζ0)² + iΓ/(2π(ζ−ζ0)) vanishes at ζ = 1.
  const kutta = (a) => {
    const dx = 1 - Zx, dy = -Zy, d2r = dx * dx - dy * dy, d2i = 2 * dx * dy, m = d2r * d2r + d2i * d2i;
    const er = Math.cos(a), ei = Math.sin(a), qr = (er * d2r + ei * d2i) / m, qi = (ei * d2r - er * d2i) / m;
    const fr = er - A * A * qr, fi = -ei - A * A * qi;
    return -2 * Math.PI * (dx * fi + dy * fr);
  };
  // Velocity at screen point (x, y) in px/s; out[2] is 1 inside the wing.
  const vel = (x, y, out) => {
    const { cx, cy, S } = G, ca = Math.cos(st.a), sa = Math.sin(st.a);
    const px = (x - cx) / S, py = (cy - y) / S, qx = px * ca - py * sa, qy = px * sa + py * ca; // into the wing's frame
    // ζ from z = ζ + 1/ζ: of the two roots, the one outside the circle.
    const rr = qx * qx - qy * qy - 4, ri = 2 * qx * qy, mod = Math.hypot(rr, ri);
    const sr = Math.sqrt((mod + rr) / 2), si = (ri < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (mod - rr) / 2));
    let zr = (qx + sr) / 2, zi = (qy + si) / 2;
    if (Math.hypot(zr - Zx, zi - Zy) < A) { zr = (qx - sr) / 2; zi = (qy - si) / 2; }
    if (Math.hypot(zr - Zx, zi - Zy) < A * 1.003) { out[2] = 1; return out; }
    const wr = zr - Zx, wi = zi - Zy, wm = wr * wr + wi * wi, w2r = wr * wr - wi * wi, w2i = 2 * wr * wi, w2m = wm * wm;
    const tr = (ca * w2r + sa * w2i) / w2m, ti = (sa * w2r - ca * w2i) / w2m, g = st.gam / (2 * Math.PI);
    const fr = ca - A * A * tr + (g * wi) / wm, fi = -sa - A * A * ti + (g * wr) / wm; // dW/dζ
    const zm = (zr * zr + zi * zi) ** 2, jr = 1 - (zr * zr - zi * zi) / zm, ji = (2 * zr * zi) / zm, jm = jr * jr + ji * ji || 1e-9; // dz/dζ
    const u = (fr * jr + fi * ji) / jm, v = -(fi * jr - fr * ji) / jm;
    let vx = (u * ca + v * sa) * U, vy = (u * sa - v * ca) * U; // back to the world, y down
    const sp = Math.hypot(vx, vy);
    if (sp > 3 * U) { vx *= (3 * U) / sp; vy *= (3 * U) / sp; }
    // Past the stall the flow over the rear of the upper surface separates: churn it.
    if (st.stall && qy > 0 && qy < 1.4 && qx > -0.8 && qx < 3) { vx += (Math.random() - 0.6) * st.stall * U; vy += (Math.random() - 0.5) * st.stall * U * 1.4; }
    // The cursor: a cylinder in the flow.
    if (pointer.x > -1e3) {
      const dx = x - pointer.x, dy = y - pointer.y, r2 = dx * dx + dy * dy, R2 = 64 * 64;
      if (r2 < R2) { const r = Math.sqrt(r2) || 1; vx += (dx / r) * U * 3; vy += (dy / r) * U * 3; }
      else { const r4 = r2 * r2; vx -= (U * R2 * (dx * dx - dy * dy)) / r4; vy -= (2 * U * R2 * dx * dy) / r4; }
    }
    out[0] = vx; out[1] = vy; out[2] = 0; return out;
  };
  const buckets = Array.from({ length: 9 }, () => []), uv = [0, 0, 0];
  const frame = (ctx, w, h, dt, t) => {
    // Angle of attack from the cursor's height (higher = more), drifting gently when there is no cursor.
    const goal = pointer.x > -1e3 ? clamp(4 + ((G.cy - pointer.y) / (h / 2)) * 11, -4, 16) : 5 + 3 * Math.sin(t * 0.4);
    st.deg += (goal - st.deg) * (dt ? Math.min(1, dt * 1.5) : 1);
    st.a = (st.deg * Math.PI) / 180; st.gam = kutta(st.a); st.stall = Math.max(0, (st.deg - 11) / 5) * 1.4;
    ctx.fillStyle = 'rgba(6, 16, 46, 0.12)'; ctx.fillRect(0, 0, w, h); // streaks fade: the trails
    if (!dt || fresh) { ctx.fillStyle = '#06102e'; ctx.fillRect(0, 0, w, h); fresh = false; }
    for (const b of buckets) b.length = 0;
    const steps = dt ? 1 : 120; // a still frame integrates the streaks in one go
    for (const p of parts) {
      for (let s = 0; s < steps; s++) {
        const x0 = p.x, y0 = p.y;
        vel(p.x, p.y, uv);
        if (uv[2]) { spawn(p, w, h, true); break; }
        const d = dt || 1 / 60;
        p.x += uv[0] * d; p.y += uv[1] * d; p.age += d;
        const sp = Math.hypot(uv[0], uv[1]) / U;
        buckets[clamp(Math.round(((sp - 0.3) / 1.5) * 8), 0, 8)].push(x0, y0, p.x, p.y);
        // Gone off the right: re-enter on the left. Expired: reappear anywhere, so the field stays even across wide screens.
        if (p.x > w + 10 || p.y < -20 || p.y > h + 20) { spawn(p, w, h, false); break; }
        if (p.age > p.life) { spawn(p, w, h, true); break; }
      }
    }
    ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    buckets.forEach((seg, i) => {
      if (!seg.length) return;
      ctx.strokeStyle = speedColour(i / 8); ctx.beginPath();
      for (let k = 0; k < seg.length; k += 4) { ctx.moveTo(seg[k], seg[k + 1]); ctx.lineTo(seg[k + 2], seg[k + 3]); }
      ctx.stroke();
    });
    // The wing: the image of the circle under the Joukowski map, pitched to the angle of attack.
    const { cx, cy, S } = G, ca = Math.cos(st.a), sa = Math.sin(st.a);
    let lo = 1e9, hi = -1e9;
    ctx.beginPath();
    for (let k = 0; k <= 96; k++) {
      const th = (k / 96) * Math.PI * 2, zr = Zx + A * Math.cos(th), zi = Zy + A * Math.sin(th), m = zr * zr + zi * zi;
      const X = zr + zr / m, Y = zi - zi / m;
      lo = Math.min(lo, X); hi = Math.max(hi, X);
      ctx.lineTo(cx + (X * ca + Y * sa) * S, cy - (Y * ca - X * sa) * S);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 20, 50, 0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(230, 240, 255, 0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    // Live readout: the angle and the lift coefficient the flow is making (Kutta–Joukowski, CL = 2Γ / U c).
    txt(ctx, `α ${st.deg.toFixed(1)}°   CL ${((2 * st.gam) / (hi - lo)).toFixed(2)}${st.stall ? '   STALL' : ''}`, cx, cy + S * 1.15, 'rgba(230,240,255,0.7)', 12, 'center', 500);
  };
  return { setup, frame };
}

// --- Avionics: a working glass cockpit. The cursor flies the aircraft like a stick (side to side banks,
// up and down pitches) unless the autopilot is on. Below the displays: BATT and AVIONICS power the panel,
// NAV and STROBE light the wingtips, MOTOR ARM (lift its guard first) lets the throttle spin the motor,
// A/P holds heading and height. RANGE and HDG knobs turn by clicking their left or right half; MAP, WX and
// TFC change the map; MASTER CAUTION lights for a new caution until pressed. Clicking the map sets a waypoint.
function avionics() {
  const W = 1200, H = 640, D = 380, RANGES = [1, 2, 5, 10], rad = Math.PI / 180;
  const st = {
    batt: true, avion: true, nav: true, strobe: false, arm: false, guard: false, ap: false, range: 1, arc: false, wx: true, tfc: true,
    thr: 0.35, rpm: 0, drain: 0, volt: 12.6, amp: 0, temp: 24, pitch: 0, bank: 0, hdg: 40, bug: 40, spd: 48, alt: 120, x: 0, y: 0,
    wpt: null, on: true, boot: -9, armT: 0, cas: '', ack: true, press: {}, hot: null, drag: false, sweep: 0,
  };
  let traffic = [], cells = [], L = { s: 1, ox: 0, oy: 0, w: 1, h: 1 };
  const sw = (k, label, i) => ({ k, label, kind: 'sw', x: 28 + i * 80, y: 470, w: 52, h: 92 });
  const CTRL = [
    sw('batt', 'BATT', 0), sw('avion', 'AVIONICS', 1), sw('nav', 'NAV LT', 2), sw('strobe', 'STROBE', 3), sw('arm', 'MOTOR ARM', 4), sw('ap', 'A/P', 5),
    { k: 'range', label: 'RANGE', kind: 'knob', x: 520, y: 470, w: 84, h: 84 },
    { k: 'hdg', label: 'HDG', kind: 'knob', x: 624, y: 470, w: 84, h: 84 },
    { k: 'arc', label: 'MAP', kind: 'btn', x: 732, y: 468, w: 88, h: 50 },
    { k: 'wx', label: 'WX', kind: 'btn', x: 828, y: 468, w: 88, h: 50 },
    { k: 'tfc', label: 'TFC', kind: 'btn', x: 924, y: 468, w: 88, h: 50 },
    { k: 'caution', label: 'MASTER CAUTION', kind: 'btn', x: 732, y: 532, w: 280, h: 50 },
    { k: 'thr', label: 'THROTTLE', kind: 'thr', x: 1052, y: 452, w: 120, h: 168 },
    { k: 'nd', kind: 'nd', x: 410, y: 0, w: D, h: D },
  ];
  const THR = CTRL.find((c) => c.k === 'thr');
  // Somewhere on the map within `far` km of the aircraft, drifting slowly.
  const spot = (far) => { const b = Math.random() * 2 * Math.PI, d = 0.3 + Math.random() * far; return { x: st.x + Math.sin(b) * d, y: st.y + Math.cos(b) * d, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02 }; };
  // The panel is drawn at a fixed size (W × H) and scaled into the right of the window, clear of the title.
  const setup = (w, h) => {
    L = { ...panelBox(w, h), w, h };
    if (!traffic.length) { traffic = Array.from({ length: 6 }, () => spot(3)); cells = Array.from({ length: 5 }, () => ({ ...spot(4), r: 0.4 + Math.random() * 0.9 })); }
  };
  const at = (x, y) => [(x - L.ox) / L.s, (y - L.oy) / L.s];
  const hit = (x, y) => { const [px, py] = at(x, y); return CTRL.find((c) => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h); };
  const ndGeo = () => (st.arc ? { cx: 410 + D / 2, cy: D * 0.86, R: D * 0.72 } : { cx: 410 + D / 2, cy: D / 2, R: D * 0.4 });
  const wrap = (d) => (((d % 360) + 540) % 360) - 180;
  const pad = (n, k = 3) => String(Math.round(n) % (k === 3 ? 360 : 100)).padStart(k, '0');

  const onDown = (x, y) => {
    const c = hit(x, y);
    if (!c) return false;
    const [px, py] = at(x, y), left = px < c.x + c.w / 2;
    st.press[c.k] = performance.now();
    switch (c.k) {
      case 'batt': st.batt = !st.batt; if (st.batt) st.drain = 0; break; // a fresh pack
      case 'arm': if (!st.guard) st.guard = true; else { st.arm = !st.arm; if (!st.arm) st.guard = false; } break;
      case 'ap': st.ap = !st.ap; if (!st.wpt) st.bug = Math.round(st.hdg); break;
      case 'range': st.range = clamp(st.range + (left ? -1 : 1), 0, RANGES.length - 1); break;
      case 'hdg': st.bug = (st.bug + (left ? -10 : 10) + 360) % 360; st.wpt = null; break;
      case 'caution': st.ack = true; break;
      case 'thr': st.drag = true; break;
      case 'nd': {
        if (!st.on) return false;
        const g = ndGeo(), dx = px - g.cx, dy = py - g.cy, b = st.hdg * rad + Math.atan2(dx, -dy), d = (Math.hypot(dx, dy) / g.R) * RANGES[st.range];
        st.wpt = { x: st.x + Math.sin(b) * d, y: st.y + Math.cos(b) * d };
        break;
      }
      default: st[c.k] = !st[c.k]; // avionics, nav, strobe, map, wx, tfc
    }
    return true;
  };
  const onUp = () => { st.drag = false; };
  const hover = (x, y) => {
    const c = hit(x, y);
    st.hot = c?.k ?? null;
    return !c ? '' : c.k === 'thr' ? 'ns-resize' : c.k === 'nd' ? (st.on ? 'crosshair' : '') : 'pointer';
  };

  const sim = (dt, t) => {
    const on = st.batt && st.avion;
    if (on && !st.on) st.boot = dt ? t : -9;
    st.on = on;
    if (st.drag) st.thr = clamp(1 - (at(pointer.x, pointer.y)[1] - THR.y - 20) / (THR.h - 40), 0, 1);
    if (!dt) return;
    let tb, tp;
    if (st.ap && on) {
      if (st.wpt) st.bug = (Math.atan2(st.wpt.x - st.x, st.wpt.y - st.y) / rad + 360) % 360;
      tb = clamp(wrap(st.bug - st.hdg) * 0.8, -25, 25); tp = clamp((120 - st.alt) * 0.08, -5, 5);
    } else if (pointer.x > -1e3) {
      tb = clamp((pointer.x - L.w / 2) / (L.w / 2), -1, 1) * 35; tp = clamp((L.h / 2 - pointer.y) / (L.h / 2), -1, 1) * 12;
    } else { tb = 12 * Math.sin(t * 0.3); tp = 2 * Math.sin(t * 0.5); }
    const k = Math.min(1, dt * 1.6);
    st.bank += (tb - st.bank) * k; st.pitch += (tp - st.pitch) * k;
    st.hdg = (st.hdg + st.bank * 0.4 * dt + 360) % 360;
    st.rpm += ((st.arm && st.batt ? st.thr : 0) - st.rpm) * Math.min(1, dt * 2);
    st.spd += (38 + 52 * st.rpm - st.pitch * 1.6 - st.spd) * Math.min(1, dt * 0.6);
    st.alt = clamp(st.alt + (st.spd / 3.6) * Math.sin(st.pitch * rad) * dt, 0, 990);
    const run = (st.spd / 3600) * dt * 4; // km; time runs fast so the map visibly moves
    st.x += Math.sin(st.hdg * rad) * run; st.y += Math.cos(st.hdg * rad) * run;
    if (st.wpt && Math.hypot(st.wpt.x - st.x, st.wpt.y - st.y) < 0.04 * RANGES[st.range]) st.wpt = null;
    for (const p of traffic) { p.x += p.vx * dt; p.y += p.vy * dt; if (Math.hypot(p.x - st.x, p.y - st.y) > 12) Object.assign(p, spot(3)); }
    for (const p of cells) if (Math.hypot(p.x - st.x, p.y - st.y) > 14) Object.assign(p, spot(4));
    st.drain = Math.min(2.2, st.drain + st.rpm * dt * 0.005);
    st.volt = st.batt ? 12.6 - st.drain - st.rpm * 0.6 : 0;
    st.amp = st.batt ? 38 * st.rpm ** 1.6 : 0;
    st.temp += (24 + st.rpm * 48 - st.temp) * Math.min(1, dt * 0.06);
    if (st.arm) st.armT += dt;
    st.sweep += dt * 1.7;
    const cas = [st.batt && st.volt < 11.1 && 'BATT LOW', st.temp > 60 && 'ESC TEMP HIGH', st.batt && !st.avion && 'AVIONICS OFF'].filter(Boolean).join('|');
    if (cas !== st.cas) { if (cas.length > st.cas.length) st.ack = false; st.cas = cas; }
  };

  // A scrolling tape (speed on the left, height on the right) with the value boxed in the middle.
  const tape = (ctx, x, y, w, h, v, ppu, tick, every, side) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(50,58,70,0.7)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d7dbe2'; ctx.lineWidth = 1.5;
    const my = y + h / 2, span = h / 2 / ppu, ex = side === 'l' ? x + w : x, dir = side === 'l' ? -1 : 1;
    for (let u = Math.ceil((v - span) / tick) * tick; u <= v + span; u += tick) {
      if (u < 0) continue;
      const ty = my - (u - v) * ppu, big = u % every === 0;
      seg(ctx, ex, ty, ex + dir * (big ? 10 : 6), ty);
      if (big) txt(ctx, String(u), x + w / 2 - dir * 5, ty + 4, '#d7dbe2', 12);
    }
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x - 2, my - 14, w + 4, 28); ctx.fill(); ctx.stroke();
    txt(ctx, String(Math.round(v)), x + w / 2, my + 6, '#fff', 15, 'center', 700);
  };

  // Primary flight display: attitude, speed and height tapes, heading, and the autopilot modes.
  const pfd = (ctx, X) => {
    const ax = X + D / 2, ay = 172, ppd = 7.5, r = 118;
    ctx.save(); ctx.beginPath(); ctx.rect(X + 58, 30, D - 116, D - 92); ctx.clip();
    ctx.translate(ax, ay); ctx.rotate(-st.bank * rad);
    const hy = st.pitch * ppd;
    ctx.fillStyle = '#1f63c6'; ctx.fillRect(-400, hy - 800, 800, 800);
    ctx.fillStyle = '#6e4420'; ctx.fillRect(-400, hy, 800, 800);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; seg(ctx, -400, hy, 400, hy);
    ctx.lineWidth = 1.5;
    for (let p = -30; p <= 30; p += 5) {
      if (!p) continue;
      const y = hy - p * ppd, hw = p % 10 ? 16 : 34;
      seg(ctx, -hw, y, hw, y);
      if (!(p % 10)) { txt(ctx, String(Math.abs(p)), -hw - 14, y + 4, '#fff', 11); txt(ctx, String(Math.abs(p)), hw + 14, y + 4, '#fff', 11); }
    }
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const l = a % 30 ? 8 : 14, s = Math.sin(a * rad), c = -Math.cos(a * rad);
      seg(ctx, s * r, c * r, s * (r + l), c * (r + l));
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(ax, ay - r + 2); ctx.lineTo(ax - 8, ay - r + 14); ctx.lineTo(ax + 8, ay - r + 14); ctx.fill();
    ctx.fillRect(ax - 78, ay - 3, 46, 6); ctx.fillRect(ax - 36, ay - 3, 6, 14); ctx.fillRect(ax + 32, ay - 3, 46, 6); ctx.fillRect(ax + 30, ay - 3, 6, 14); ctx.fillRect(ax - 4, ay - 4, 8, 8);
    tape(ctx, X + 6, 30, 46, D - 92, st.spd, 3, 5, 10, 'l');
    tape(ctx, X + D - 52, 30, 46, D - 92, st.alt, 0.9, 10, 50, 'r');
    txt(ctx, 'KM/H', X + 29, D - 44, '#9aa3b2', 10); txt(ctx, 'M', X + D - 29, D - 44, '#9aa3b2', 10);
    // Heading tape along the bottom, with the selected heading as a magenta bug.
    const tx = X + 58, ty = D - 54, tw = D - 116, tcx = tx + tw / 2, hp = 4;
    ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, 40); ctx.clip();
    ctx.fillStyle = 'rgba(50,58,70,0.7)'; ctx.fillRect(tx, ty, tw, 40);
    ctx.strokeStyle = '#d7dbe2'; ctx.lineWidth = 1.5;
    for (let d = Math.ceil((st.hdg - tw / 2 / hp) / 5) * 5; d <= st.hdg + tw / 2 / hp; d += 5) {
      const x = tcx + (d - st.hdg) * hp, n = ((d % 360) + 360) % 360;
      seg(ctx, x, ty, x, ty + (n % 10 ? 6 : 12));
      if (!(n % 30)) txt(ctx, { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] ?? String(n / 10).padStart(2, '0'), x, ty + 30, '#d7dbe2', 12);
    }
    ctx.fillStyle = '#ff3dd2'; ctx.fillRect(tcx + wrap(st.bug - st.hdg) * hp - 6, ty, 12, 5);
    ctx.restore();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(tcx, ty + 8); ctx.lineTo(tcx - 6, ty - 2); ctx.lineTo(tcx + 6, ty - 2); ctx.fill();
    txt(ctx, st.ap ? (st.wpt ? 'A/P  NAV' : `A/P  HDG ${pad(st.bug)}`) : 'MANUAL', X + 60, 20, st.ap ? '#3dff9a' : '#d7dbe2', 12, 'left');
    if (st.ap) txt(ctx, 'ALT HOLD', X + D / 2 + 30, 20, '#3dff9a', 12, 'left');
    txt(ctx, `THR ${Math.round(st.thr * 100)}`, X + D - 60, 20, '#38d7ff', 12, 'right');
  };

  // Navigation display: compass rose (or forward arc), weather, traffic, radar sweep, waypoint.
  const nd = (ctx, X) => {
    const { cx, cy, R } = ndGeo(), rng = RANGES[st.range], hr = st.hdg * rad;
    const toS = (wx, wy) => { const dx = wx - st.x, dy = wy - st.y, b = Math.atan2(dx, dy) - hr, d = (Math.hypot(dx, dy) / rng) * R; return [cx + Math.sin(b) * d, cy - Math.cos(b) * d, d]; };
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    if (st.wx) for (const c of cells) {
      const [x, y, d] = toS(c.x, c.y), r = (c.r / rng) * R;
      if (d - r > R) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,60,50,0.6)'); g.addColorStop(0.35, 'rgba(255,210,60,0.45)'); g.addColorStop(0.7, 'rgba(40,200,90,0.35)'); g.addColorStop(1, 'rgba(40,200,90,0)');
      ctx.fillStyle = g; dot(ctx, x, y, r);
    }
    const ang = (st.arc ? Math.sin(st.sweep * 0.8) : st.sweep % (2 * Math.PI)) - Math.PI / 2, dir = st.arc && Math.cos(st.sweep * 0.8) < 0 ? -1 : 1;
    for (let k = 0; k < 20; k++) {
      const a0 = ang - dir * (k + 1) * 0.03, a1 = ang - dir * k * 0.03;
      ctx.fillStyle = `rgba(61,255,154,${0.16 * (1 - k / 20)})`; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1)); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,210,225,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, String(rng / 2), cx + R * 0.36, cy - R * 0.36, 'rgba(200,210,225,0.7)', 11, 'left');
    ctx.strokeStyle = '#d7dbe2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    for (let d = 0; d < 360; d += 5) {
      const a = (d - st.hdg) * rad, l = d % 10 ? 7 : 14, s = Math.sin(a), c = -Math.cos(a);
      seg(ctx, cx + s * R, cy + c * R, cx + s * (R - l), cy + c * (R - l));
      if (!(d % 30)) txt(ctx, { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10), cx + s * (R - 26), cy + c * (R - 26) + 5, '#d7dbe2', 13);
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((st.bug - st.hdg) * rad); ctx.fillStyle = '#ff3dd2'; ctx.fillRect(-7, -R - 8, 14, 8); ctx.restore();
    if (st.wpt) {
      const [x, y] = toS(st.wpt.x, st.wpt.y), d = Math.hypot(st.wpt.x - st.x, st.wpt.y - st.y);
      ctx.strokeStyle = '#ff3dd2'; ctx.lineWidth = 2.5; seg(ctx, cx, cy, x, y);
      ctx.fillStyle = '#ff3dd2'; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.fill();
      txt(ctx, `WPT ${d.toFixed(1)} KM`, x + 12, y - 10, '#ff3dd2', 11, 'left');
    }
    if (st.tfc) for (const p of traffic) {
      const [x, y, d] = toS(p.x, p.y);
      if (d > R) continue;
      const near = d < R * 0.25;
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath();
      if (near) { ctx.fillStyle = '#ffb02e'; ctx.fill(); } else { ctx.strokeStyle = '#38d7ff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx - 9, cy + 10); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx + 9, cy + 10); ctx.fill();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(X + D / 2 - 46, 6, 92, 24); ctx.fill(); ctx.stroke();
    txt(ctx, `HDG ${pad(st.hdg)}`, X + D / 2, 23, '#fff', 13);
    txt(ctx, `GS ${Math.round(st.spd)}`, X + 10, 22, '#d7dbe2', 12, 'left');
    txt(ctx, `${st.arc ? 'ARC' : 'ROSE'} ${rng} KM`, X + D - 10, 22, '#d7dbe2', 12, 'right');
    txt(ctx, [st.wx && 'WX', st.tfc && 'TFC'].filter(Boolean).join(' · '), X + 10, D - 12, '#3dff9a', 11, 'left');
    txt(ctx, 'CLICK MAP: WAYPOINT', X + D - 10, D - 12, 'rgba(154,163,178,0.85)', 10, 'right');
  };

  // Motor and battery: RPM dial, volt/amp/ESC temperature bars, arm state and the alert list.
  const eicas = (ctx, X) => {
    const gx = X + 110, gy = 130, r = 74, a0 = 0.75 * Math.PI, span = 1.5 * Math.PI, a = a0 + span * st.rpm;
    txt(ctx, 'MOTOR · BATTERY', X + 12, 22, '#9aa3b2', 11, 'left');
    ctx.lineWidth = 10; ctx.strokeStyle = '#262b33'; ctx.beginPath(); ctx.arc(gx, gy, r, a0, a0 + span); ctx.stroke();
    ctx.strokeStyle = st.rpm > 0.9 ? '#ffb02e' : '#3dff9a'; ctx.beginPath(); ctx.arc(gx, gy, r, a0, a); ctx.stroke();
    ctx.strokeStyle = '#ff3b2f'; ctx.lineWidth = 3; seg(ctx, gx + Math.cos(a0 + span) * (r - 8), gy + Math.sin(a0 + span) * (r - 8), gx + Math.cos(a0 + span) * (r + 8), gy + Math.sin(a0 + span) * (r + 8));
    ctx.strokeStyle = '#fff'; seg(ctx, gx, gy, gx + Math.cos(a) * (r - 16), gy + Math.sin(a) * (r - 16));
    txt(ctx, String(Math.round(st.rpm * 100)), gx, gy + 40, '#fff', 26, 'center', 700); txt(ctx, '% RPM', gx, gy + 60, '#9aa3b2', 11);
    [['BATT V', st.volt, 9.9, 12.6, st.volt < 11.1 ? '#ffb02e' : '#3dff9a', st.volt.toFixed(1)],
      ['AMP', st.amp, 0, 40, '#38d7ff', String(Math.round(st.amp))],
      ['ESC °C', st.temp, 20, 80, st.temp > 60 ? '#ffb02e' : '#3dff9a', String(Math.round(st.temp))]].forEach(([name, v, lo, hi, col, shown], i) => {
      const bx = X + 222 + i * 52, top = 58, hg = 150, k = clamp((v - lo) / (hi - lo), 0, 1);
      ctx.fillStyle = '#1a1e26'; ctx.fillRect(bx, top, 22, hg);
      ctx.fillStyle = col; ctx.fillRect(bx, top + hg * (1 - k), 22, hg * k);
      ctx.strokeStyle = '#4a5262'; ctx.lineWidth = 1; ctx.strokeRect(bx, top, 22, hg);
      txt(ctx, shown, bx + 11, top - 8, col, 12); txt(ctx, name, bx + 11, top + hg + 16, '#9aa3b2', 10);
    });
    txt(ctx, st.arm ? 'ARMED' : st.guard ? 'GUARD OPEN' : 'SAFE', X + 110, 238, st.arm ? '#ff5a3d' : st.guard ? '#ffb02e' : '#3dff9a', 15, 'center', 700);
    txt(ctx, `MOTOR TIME ${pad(st.armT / 60, 2)}:${pad(st.armT % 60, 2)}`, X + 110, 258, '#9aa3b2', 11);
    ctx.strokeStyle = '#3a4150'; ctx.lineWidth = 1; ctx.strokeRect(X + 12, 276, D - 24, 92);
    const lines = [...st.cas.split('|').filter(Boolean).map((m) => [m, '#ffb02e']), st.ap && ['A/P ENGAGED', '#3dff9a'], st.wpt && ['WAYPOINT ACTIVE', '#ff3dd2'],
      st.nav && ['NAV LIGHTS ON', '#d7dbe2'], st.strobe && ['STROBE ON', '#d7dbe2']].filter(Boolean).slice(0, 5);
    lines.forEach(([m, c], i) => txt(ctx, m, X + 24, 296 + i * 17, c, 12, 'left'));
  };

  // The controls below the displays.
  const plate = (ctx, c) => { ctx.fillStyle = '#1a1e26'; ctx.strokeStyle = st.hot === c.k ? '#7dffbd' : '#3a4150'; ctx.lineWidth = 1.5; box(ctx, c.x, c.y, c.w, c.h, 8); ctx.fill(); ctx.stroke(); };
  const drawSw = (ctx, c, t) => {
    const up = st[c.k], mx = c.x + c.w / 2, my = c.y + 40, end = my + (up ? -26 : 26);
    plate(ctx, c);
    ctx.fillStyle = '#4b5361'; dot(ctx, mx, my, 11);
    ctx.strokeStyle = '#e1e5ea'; ctx.lineWidth = 9; ctx.lineCap = 'round'; seg(ctx, mx, my, mx, end); ctx.lineCap = 'butt';
    ctx.fillStyle = '#f4f6f8'; dot(ctx, mx, end, 6);
    const lamp = !up || !st.batt ? '#262b33' : c.k === 'arm' ? '#ff5a3d' : c.k === 'strobe' ? (t % 1.1 < 0.08 ? '#fff' : '#3a4048') : '#3dff9a';
    ctx.fillStyle = lamp; dot(ctx, mx, c.y + c.h - 11, 5);
    if (c.k === 'arm') {
      ctx.fillStyle = 'rgba(214,52,40,0.9)';
      if (st.guard) { box(ctx, c.x - 4, c.y - 15, c.w + 8, 11, 3); ctx.fill(); }
      else {
        box(ctx, c.x - 4, c.y + 4, c.w + 8, 72, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) seg(ctx, c.x - 2, c.y + 14 + i * 11, c.x + c.w + 2, c.y + 4 + i * 11);
        txt(ctx, 'LIFT', mx, c.y + 46, '#fff', 11, 'center', 700);
      }
    }
    txt(ctx, c.label, mx, c.y + c.h + 18, '#9aa3b2', 11);
  };
  const drawKnob = (ctx, c) => {
    const mx = c.x + c.w / 2, my = c.y + c.h / 2 - 4, r = 30;
    const deg = c.k === 'range' ? -135 + (st.range / (RANGES.length - 1)) * 270 : st.bug;
    if (st.hot === c.k) { ctx.strokeStyle = '#7dffbd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, my, r + 10, 0, 7); ctx.stroke(); }
    const g = ctx.createRadialGradient(mx - 8, my - 10, 4, mx, my, r); g.addColorStop(0, '#6a7280'); g.addColorStop(1, '#22262d');
    ctx.fillStyle = g; dot(ctx, mx, my, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; seg(ctx, mx + Math.cos(a) * (r - 4), my + Math.sin(a) * (r - 4), mx + Math.cos(a) * r, my + Math.sin(a) * r); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; seg(ctx, mx, my, mx + Math.sin(deg * rad) * (r - 7), my - Math.cos(deg * rad) * (r - 7));
    txt(ctx, '−', mx - r - 10, my + 5, '#9aa3b2', 14); txt(ctx, '+', mx + r + 10, my + 5, '#9aa3b2', 14);
    txt(ctx, `${c.label} ${c.k === 'range' ? `${RANGES[st.range]} KM` : pad(st.bug)}`, mx, c.y + c.h + 14, '#9aa3b2', 11);
  };
  const drawBtn = (ctx, c, t, now) => {
    const caution = c.k === 'caution', on = c.k === 'arc' ? st.arc : caution ? !!st.cas : st[c.k];
    const pressed = now - (st.press[c.k] ?? -1e4) < 160, flash = caution && st.batt && on && !st.ack && t % 0.8 < 0.45;
    ctx.fillStyle = flash ? '#ffb02e' : pressed ? '#2f3846' : '#1c212a'; ctx.strokeStyle = st.hot === c.k ? '#7dffbd' : '#4a5262'; ctx.lineWidth = 1.5;
    box(ctx, c.x, c.y + (pressed ? 2 : 0), c.w, c.h, 6); ctx.fill(); ctx.stroke();
    if (!caution) { ctx.fillStyle = on && st.on ? '#3dff9a' : '#2a2f38'; ctx.fillRect(c.x + 14, c.y + 8, c.w - 28, 4); }
    const label = c.k === 'arc' ? (st.arc ? 'MAP ARC' : 'MAP ROSE') : c.label;
    txt(ctx, label, c.x + c.w / 2, c.y + c.h / 2 + (caution ? 5 : 9), flash ? '#1a1000' : caution ? (on && st.batt ? '#ffb02e' : '#6b5a3a') : '#c9d0da', caution ? 14 : 12, 'center', 700);
  };
  const drawThr = (ctx, c) => {
    plate(ctx, c);
    const sx = c.x + c.w / 2, top = c.y + 20, bot = c.y + c.h - 20, ly = bot - st.thr * (bot - top);
    ctx.fillStyle = '#07090c'; ctx.fillRect(sx - 6, top, 12, bot - top);
    ctx.strokeStyle = '#6b7380'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const y = bot - (i / 10) * (bot - top); seg(ctx, c.x + 10, y, c.x + (i % 5 ? 18 : 24), y); }
    txt(ctx, 'MAX', c.x + c.w - 8, top + 4, '#6b7380', 10, 'right'); txt(ctx, 'IDLE', c.x + c.w - 8, bot + 4, '#6b7380', 10, 'right');
    const g = ctx.createLinearGradient(0, ly - 12, 0, ly + 12); g.addColorStop(0, '#f1f3f6'); g.addColorStop(1, '#9aa1ab');
    ctx.fillStyle = g; ctx.strokeStyle = '#5b6372'; box(ctx, sx - 30, ly - 12, 60, 24, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; for (const d of [-6, 0, 6]) seg(ctx, sx - 20, ly + d, sx + 20, ly + d);
    txt(ctx, `${c.label} ${Math.round(st.thr * 100)}%`, sx, c.y + c.h + 14, '#9aa3b2', 11);
  };
  const selfTest = (ctx, X, k) => {
    ['#ff3b2f', '#f3e64a', '#29d17a', '#18b8e6', '#1d4fd8', '#ff3dd2'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(X + (i * D) / 6, 0, D / 6 + 1, D * Math.min(1, k * 1.5)); });
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X, D / 2 - 24, D, 48);
    txt(ctx, 'SELF TEST', X + D / 2, D / 2 + 6, '#fff', 16, 'center', 700);
  };

  const frame = (ctx, w, h, dt, t) => {
    sim(dt, t);
    const now = performance.now();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#151a22'); g.addColorStop(1, '#07090c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Panel seams and rivets.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 240) seg(ctx, x, 0, x, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 12; x < w; x += 240) for (let y = 12; y < h; y += 60) dot(ctx, x, y, 1.6);
    // Wingtip lights at the window's edges: red to port, green to starboard, and the strobe's flash.
    if (st.batt && st.nav) for (const [x, c] of [[0, '255,40,40'], [w, '40,255,120']]) {
      const r = Math.min(w, h) * 0.4, wg = ctx.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, r);
      wg.addColorStop(0, `rgba(${c},0.22)`); wg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = wg; ctx.fillRect(x - r, h * 0.5 - r, r * 2, r * 2);
    }
    if (st.batt && st.strobe && t % 1.1 < 0.07) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, 0, w, h); }
    ctx.save(); ctx.translate(L.ox, L.oy); ctx.scale(L.s, L.s);
    [[pfd, 'PFD'], [nd, 'NAV'], [eicas, 'ENGINE']].forEach(([draw, name], i) => {
      const X = i * 410, b = t - st.boot;
      ctx.fillStyle = '#181c23'; ctx.strokeStyle = '#353c48'; ctx.lineWidth = 2; box(ctx, X - 10, -10, D + 20, D + 20, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#030405'; ctx.fillRect(X, 0, D, D);
      if (st.on && b > 1.2) { ctx.save(); ctx.beginPath(); ctx.rect(X, 0, D, D); ctx.clip(); draw(ctx, X); ctx.restore(); }
      else if (st.on) selfTest(ctx, X, b / 1.2);
      const gl = ctx.createLinearGradient(X, 0, X + D, D); gl.addColorStop(0, 'rgba(255,255,255,0.06)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(X, 0, D, D);
      txt(ctx, name, X + D / 2, D + 24, '#6b7380', 11);
    });
    ctx.fillStyle = '#12161c'; ctx.strokeStyle = '#2c323d'; ctx.lineWidth = 2; box(ctx, 0, 432, W, 208, 14); ctx.fill(); ctx.stroke();
    for (const [name, x0, x1] of [['ELECTRICAL', 28, 160], ['LIGHTS', 188, 320], ['MOTOR', 348, 400], ['FLIGHT', 428, 480], ['EFIS', 520, 1012]]) txt(ctx, name, (x0 + x1) / 2, 448, '#6b7380', 10);
    for (const c of CTRL) {
      if (c.kind === 'sw') drawSw(ctx, c, t);
      else if (c.kind === 'knob') drawKnob(ctx, c);
      else if (c.kind === 'btn') drawBtn(ctx, c, t, now);
      else if (c.kind === 'thr') drawThr(ctx, c);
    }
    ctx.restore();
  };
  return { setup, frame, onDown, onUp, hover };
}

// --- Design: modal and stress analysis of a wing structure, in the style of an FEA viewer. The 012's wing
// box (spar caps and webs, truss ribs, bracing) and fuselage frame bend through three mode shapes in turn,
// each member coloured by the stress it carries (blue low, red high), over the undeformed shape dashed.
// The cursor near the wing's front spar loads it there, bending the wing toward the cursor.
const beam = (b, sg) => (s) => Math.cosh(b * s) - Math.cos(b * s) - sg * (Math.sinh(b * s) - Math.sin(b * s)); // cantilever mode shapes
const curve = (b, sg) => (s) => (Math.cosh(b * s) + Math.cos(b * s) - sg * (Math.sinh(b * s) + Math.sin(b * s))) / 2; // their curvature, 1 at the root
const [m1, m2] = [beam(1.8751, 0.7341), beam(4.6941, 1.0185)], [k1, k2] = [curve(1.8751, 0.7341), curve(4.6941, 1.0185)];
const phi1 = (s) => m1(s) / m1(1), phi2 = (s) => m2(s) / m2(1);
const MODES = ['MODE 1 · FIRST BENDING', 'MODE 2 · TORSION', 'MODE 3 · SECOND BENDING'];
const FAC = { bend: { cap: 1, edge: 0.7, web: 0.5, diag: 0.55, rib: 0.35 }, twist: { cap: 0.45, edge: 0.6, web: 0.85, diag: 1, rib: 0.75 } };
function design() {
  const N = 8, ZK = [0, 0.05, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1], nodes = [], segs = [], probe = [], id = {};
  const naca = (z) => 0.6 * (0.2969 * Math.sqrt(z) - 0.126 * z - 0.3516 * z * z + 0.2843 * z ** 3 - 0.1015 * z ** 4);
  const node = (n) => nodes.push(n) - 1;
  const link = (a, b, type, side = 0, s = 0) => segs.push({ a, b, type, side, s });
  // Each wing half: N + 1 truss ribs, two spars with upper and lower caps, leading and trailing edges.
  for (const side of [-1, 1]) {
    for (let i = 0; i <= N; i++) for (let k = 0; k < ZK.length; k++) for (const u of [1, -1]) {
      const s = i / N, c = 0.34 - 0.1 * s, z = ZK[k];
      id[[side, i, k, u]] = node({ wing: true, side, s, X: side * (0.07 + 0.93 * s), Y: 0.05 * s + u * naca(z) * c, Z: 0.04 * s + z * c, arm: (z - 0.35) * c });
    }
    const n = (i, k, u) => id[[side, i, k, u]];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      for (let k = 0; k < ZK.length - 1; k++) for (const u of [1, -1]) link(n(i, k, u), n(i, k + 1, u), 'rib', side, s);
      for (const k of [2, 4, 5, 7]) link(n(i, k, 1), n(i, k, -1), 'rib', side, s);
      for (const k of [3, 6]) link(n(i, k, 1), n(i, k, -1), 'web', side, s);
      if (i >= 2) probe.push(n(i, 3, 1));
      if (i === N) continue;
      const m = (i + 0.5) / N;
      for (const k of [3, 6]) for (const u of [1, -1]) link(n(i, k, u), n(i + 1, k, u), 'cap', side, m);
      for (const k of [0, 5, 8]) link(n(i, k, 1), n(i + 1, k, 1), 'edge', side, m);
      link(n(i, 3, 1), n(i + 1, 3, -1), 'web', side, m); link(n(i, 6, -1), n(i + 1, 6, 1), 'web', side, m);
      link(n(i, i % 2 ? 6 : 3, 1), n(i + 1, i % 2 ? 3 : 6, 1), 'diag', side, m);
    }
  }
  // The fuselage: a braced box frame under the wing, tapering to the tail, with the tailplane and fin.
  const ring = [-0.62, -0.38, -0.1, 0.16, 0.42, 0.78, 1.14, 1.5, 1.86].map((z) => {
    const tail = Math.max(0, (z - 0.6) / 1.3), hw = z < -0.3 ? 0.045 : 0.065 - 0.035 * tail, bot = -0.18 + 0.12 * tail + (z < -0.3 ? 0.04 : 0);
    return [[-hw, -0.02], [hw, -0.02], [hw, bot], [-hw, bot]].map(([X, Y]) => node({ X, Y, Z: z }));
  });
  ring.forEach((r, j) => {
    for (let q = 0; q < 4; q++) { link(r[q], r[(q + 1) % 4], 'fuse'); if (j) link(ring[j - 1][q], r[q], 'fuse'); }
    if (j) { link(ring[j - 1][0], r[3], 'fuse'); link(ring[j - 1][1], r[2], 'fuse'); }
  });
  for (const side of [-1, 1]) { const p = [[0.03, 1.58], [0.32, 1.68], [0.32, 1.84], [0.03, 1.86]].map(([X, Z]) => node({ X: side * X, Y: -0.03, Z })); p.slice(1).forEach((b, q) => link(p[q], b, 'fuse')); }
  const fin = [[-0.03, 1.56], [0.2, 1.76], [0.2, 1.86], [-0.03, 1.88]].map(([Y, Z]) => node({ X: 0, Y, Z }));
  fin.slice(1).forEach((b, q) => link(fin[q], b, 'fuse'));

  let grid = null, G = null;
  const load = { side: 1, a: 1, P: 0 };
  const setup = (w, h) => {
    // The blueprint sheet, drawn once per size.
    const dpr = 1; // the backdrop canvas is drawn at one pixel per CSS pixel
    grid = sheet(w * dpr, h * dpr);
    const g = grid.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = '#0d2a66'; g.fillRect(0, 0, w, h);
    for (const [step, a] of [[24, 0.08], [120, 0.18]]) {
      g.strokeStyle = `rgba(120,170,255,${a})`; g.lineWidth = 1; g.beginPath();
      for (let x = 0.5; x < w; x += step) { g.moveTo(x, 0); g.lineTo(x, h); }
      for (let y = 0.5; y < h; y += step) { g.moveTo(0, y); g.lineTo(w, y); }
      g.stroke();
    }
    G = { cx: w * 0.6, cy: h * 0.56, F: Math.min(w * 0.95, h * 1.8) };
  };
  const q = [0, 0], buckets = Array.from({ length: 24 }, () => []);
  const frame = (ctx, w, h, dt, t) => {
    ctx.drawImage(grid, 0, 0, w, h);
    const P = 7, m = Math.floor(t / P) % 3, ph = t % P, env = Math.min(1, ph / 1.2, (P - ph) / 1.2);
    // The cursor near the front spar presses on it there, pulling the wing toward the cursor.
    let best = null, bd = 170;
    for (const j of probe) { const n = nodes[j], d = Math.hypot(n.gx - pointer.x, n.gy - pointer.y); if (d < bd) { bd = d; best = n; } }
    if (best) { if (best.side !== load.side && Math.abs(load.P) < 0.05) load.side = best.side; load.a += (best.s - load.a) * Math.min(1, dt * 6); }
    const goal = best && best.side === load.side ? clamp((best.gy - pointer.y) / 140, -1, 1) : 0;
    load.P += (goal - load.P) * Math.min(1, dt * 4);
    const am = env * Math.sin([2.4, 3.1, 4.3][m] * t) * (1 - 0.7 * Math.abs(load.P));
    // A slowly turning three-quarter view from above.
    const yaw = 0.6 + 0.2 * Math.sin(t * 0.13), pit = 0.4 + 0.05 * Math.sin(t * 0.09);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const proj = (X, Y, Z) => { const z = Z - 0.5, x1 = X * cyw + z * syw, z1 = -X * syw + z * cyw, d = Y * sp + z1 * cp + 3.2; q[0] = G.cx + (x1 * G.F) / d; q[1] = G.cy - ((Y * cp - z1 * sp) * G.F) / d; };
    for (const n of nodes) {
      let dy = 0;
      if (n.wing) {
        dy = m === 1 ? am * 0.45 * Math.sin((Math.PI * n.s) / 2) * n.arm : am * (m ? 0.1 * phi2(n.s) : 0.2 * phi1(n.s));
        if (n.side === load.side) { const a = load.a, s = n.s; dy += load.P * 0.2 * (s <= a ? (s * s * (3 * a - s)) / 2 : (a * a * (3 * s - a)) / 2); }
      }
      proj(n.X, n.Y, n.Z); n.gx = q[0]; n.gy = q[1];
      proj(n.X, n.Y + dy, n.Z); n.sx = q[0]; n.sy = q[1];
    }
    // Stress in each member: the mode's curvature (or twist) at its span station, plus the point load's moment.
    for (const b of buckets) b.length = 0;
    const root = Math.abs(am) + Math.abs(load.P) * load.a;
    for (const g of segs) {
      const A = nodes[g.a], B = nodes[g.b];
      let v;
      if (!g.side) v = root * 0.4 * Math.exp(-((((A.Z + B.Z) / 2 - 0.15) / 0.5) ** 2));
      else {
        const shape = m === 1 ? Math.cos((Math.PI * g.s) / 2) : (m ? k2 : k1)(g.s);
        v = Math.abs(am * shape * FAC[m === 1 ? 'twist' : 'bend'][g.type] + (g.side === load.side ? load.P * Math.max(0, load.a - g.s) * FAC.bend[g.type] : 0));
      }
      buckets[Math.min(11, Math.floor(Math.min(1, v * 1.15) * 12)) + (g.type === 'cap' || g.type === 'edge' ? 12 : 0)].push(A.sx, A.sy, B.sx, B.sy);
    }
    ctx.strokeStyle = 'rgba(200,220,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.beginPath();
    for (const g of segs) if (g.type === 'cap' || g.type === 'edge') { const A = nodes[g.a], B = nodes[g.b]; ctx.moveTo(A.gx, A.gy); ctx.lineTo(B.gx, B.gy); }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round';
    buckets.forEach((b, i) => {
      if (!b.length) return;
      const heavy = i >= 12;
      ctx.strokeStyle = speedColour((i % 12) / 11); ctx.beginPath();
      for (let k = 0; k < b.length; k += 4) { ctx.moveTo(b[k], b[k + 1]); ctx.lineTo(b[k + 2], b[k + 3]); }
      ctx.globalAlpha = 0.14; ctx.lineWidth = heavy ? 8 : 5; ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.lineWidth = heavy ? 2.4 : 1.3; ctx.stroke();
    });
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    // Drawing annotations: span, tip deflection, the root, the load.
    const ink = 'rgba(207,224,255,0.75)', tipL = nodes[id[[-1, N, 3, 1]]], tipR = nodes[id[[1, N, 3, 1]]], rootR = nodes[id[[1, 0, 3, 1]]];
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    const sy0 = Math.max(tipL.gy, tipR.gy) + 70;
    seg(ctx, tipL.gx, sy0, tipR.gx, sy0); seg(ctx, tipL.gx, sy0 - 6, tipL.gx, sy0 + 6); seg(ctx, tipR.gx, sy0 - 6, tipR.gx, sy0 + 6);
    txt(ctx, 'SPAN', (tipL.gx + tipR.gx) / 2, sy0 - 8, ink, 11, 'center', 500);
    const room = tipR.gx < w - 150, dx = tipR.gx + (room ? 18 : -18);
    seg(ctx, dx, tipR.gy, dx, tipR.sy); seg(ctx, dx - 5, tipR.gy, dx + 5, tipR.gy); seg(ctx, dx - 5, tipR.sy, dx + 5, tipR.sy);
    txt(ctx, 'TIP DEFLECTION', dx + (room ? 8 : -8), (tipR.gy + tipR.sy) / 2 + 4, ink, 11, room ? 'left' : 'right', 500);
    const side = rootR.sx + 200 < w ? 1 : -1; // callout to the right, or to the left where there's no room
    seg(ctx, rootR.sx, rootR.sy, rootR.sx + side * 40, rootR.sy - 80); seg(ctx, rootR.sx + side * 40, rootR.sy - 80, rootR.sx + side * 60, rootR.sy - 80);
    txt(ctx, 'ROOT · PEAK STRESS', rootR.sx + side * 66, rootR.sy - 76, ink, 11, side > 0 ? 'left' : 'right', 500);
    if (Math.abs(load.P) > 0.08) {
      const n = nodes[id[[load.side, Math.round(load.a * N), 3, 1]]], dir = load.P > 0 ? -1 : 1, y1 = n.sy + dir * 54;
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; seg(ctx, n.sx, n.sy, n.sx, y1);
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(n.sx, n.sy); ctx.lineTo(n.sx - 6, n.sy + dir * 10); ctx.lineTo(n.sx + 6, n.sy + dir * 10); ctx.fill();
      txt(ctx, 'LOAD', n.sx + 8, y1 + 4, '#ffd23f', 11, 'left', 700);
    }
    // Legend, bottom right.
    const lx = w - 24, ly = h - 28, lg = ctx.createLinearGradient(lx - 180, 0, lx, 0);
    for (const s of [0, 0.25, 0.5, 0.75, 1]) lg.addColorStop(s, speedColour(s));
    ctx.fillStyle = lg; ctx.fillRect(lx - 180, ly, 180, 6);
    txt(ctx, 'LOW STRESS', lx - 180, ly - 8, ink, 10, 'left', 500); txt(ctx, 'HIGH STRESS', lx, ly - 8, ink, 10, 'right', 500);
    txt(ctx, Math.abs(load.P) > 0.1 ? 'STATIC LOAD · CURSOR' : MODES[m], lx, ly - 28, 'rgba(232,241,255,0.9)', 12, 'right', 700);
    txt(ctx, 'MODAL ANALYSIS · DEFLECTION EXAGGERATED', lx, ly - 46, ink, 10, 'right', 500);
  };
  return { setup, frame };
}

// --- Social Media: a spinning dot globe (real coastlines), with posts arcing between places. Moving
// the cursor across it pushes the spin along with it, and tilts it toward the cursor.
const landAt = (() => { const b = typeof atob === 'function' ? atob(LAND) : ''; return (r, c) => (b.charCodeAt((r * 180 + c) >> 3) >> ((r * 180 + c) & 7)) & 1; })();
function social() {
  let dots = [], stars = [], arcs = [], G = null;
  const st = { lon: 0, spin: 0.12, tilt: 0.3 };
  const setup = (w, h) => {
    G = { cx: w * 0.68, cy: h * 0.52, R: Math.min(w * 0.34, h * 0.42) };
    if (!dots.length) {
      for (let r = 0; r < 90; r++) {
        const lat = (89 - r * 2) * (Math.PI / 180), step = Math.max(1, Math.round(1 / Math.cos(lat)));
        for (let c = 0; c < 180; c += step) if (landAt(r, c)) dots.push([lat, (-179 + c * 2) * (Math.PI / 180)]);
      }
      const pick = () => dots[(Math.random() * dots.length) | 0];
      arcs = Array.from({ length: 9 }, (_, i) => ({ a: pick(), b: pick(), t: i / 9 }));
      arcs.pick = pick;
    }
    stars = Array.from({ length: 160 }, () => [Math.random() * w, Math.random() * h, Math.random()]);
  };
  const project = ([lat, lon], out) => {
    const x = Math.cos(lat) * Math.sin(lon + st.lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon + st.lon);
    const y2 = y * Math.cos(st.tilt) - z * Math.sin(st.tilt), z2 = y * Math.sin(st.tilt) + z * Math.cos(st.tilt);
    out[0] = G.cx + x * G.R; out[1] = G.cy - y2 * G.R; out[2] = z2; return out;
  };
  const p = [0, 0, 0], q = [0, 0, 0];
  // Brightness in 16 steps, each colour made once: a frame sets 16 fill styles, not one per dot (thousands of
  // new colour strings a frame meant a garbage-collection pause every few seconds on a phone).
  const L = 16, step = (f) => Math.max(0, Math.min(L, Math.round(f * L)));
  const LANDC = Array.from({ length: L + 1 }, (_, i) => `rgba(120,190,255,${(0.35 + (i / L) * 0.65).toFixed(3)})`);
  const STAR = Array.from({ length: L + 1 }, (_, i) => `rgba(200,215,255,${(0.2 + (i / L) * 0.5).toFixed(3)})`);
  const bins = Array.from({ length: L + 1 }, () => ({ n: 0, xy: new Float32Array(0) }));
  const put = (b, x, y) => { if (b.n + 2 > b.xy.length) { const g = new Float32Array(Math.max(64, b.xy.length * 2)); g.set(b.xy); b.xy = g; } b.xy[b.n++] = x; b.xy[b.n++] = y; };
  const frame = (ctx, w, h, dt, t) => {
    const { cx, cy, R } = G;
    ctx.fillStyle = '#04060d'; ctx.fillRect(0, 0, w, h);
    for (const b of bins) b.n = 0;
    for (const [x, y, s] of stars) put(bins[step(s * (0.6 + 0.4 * Math.sin(t * 2 + s * 9)))], x, y);
    bins.forEach((b, i) => { if (!b.n) return; ctx.fillStyle = STAR[i]; for (let k = 0; k < b.n; k += 2) ctx.fillRect(b.xy[k], b.xy[k + 1], 1.4, 1.4); });
    // The cursor drags the spin along; the spin eases back to its cruise.
    const dx = pointer.x - cx, dy = pointer.y - cy, near = Math.hypot(dx, dy) < R * 1.5;
    if (near && dt) { st.spin += pointer.vx * 0.9 * dt * 60 * 0.02; pointer.vx *= 0.8; }
    st.spin += (0.12 - st.spin) * Math.min(1, dt * 0.8);
    st.tilt += ((near ? 0.3 + (dy / R) * 0.25 : 0.3) - st.tilt) * Math.min(1, dt * 2);
    st.lon += st.spin * (dt || 0);
    // Atmosphere.
    const a = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
    a.addColorStop(0, 'rgba(70,140,255,0.28)'); a.addColorStop(1, 'rgba(70,140,255,0)');
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 7); ctx.fill();
    ctx.fillStyle = '#07112a'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // Land as dots: bright in front, a faint hint of the far side through the globe.
    for (const b of bins) b.n = 0;
    ctx.fillStyle = 'rgba(120,190,255,0.08)';
    for (const d of dots) {
      project(d, p);
      if (p[2] < -0.2) continue;
      if (p[2] <= 0) ctx.fillRect(p[0] - 0.45, p[1] - 0.45, 0.9, 0.9);
      else put(bins[step(p[2])], p[0], p[1]);
    }
    bins.forEach((b, i) => {
      if (!b.n) return;
      const sz = 1.1 + (i / L) * 1.4, o = sz / 2;
      ctx.fillStyle = LANDC[i];
      for (let k = 0; k < b.n; k += 2) ctx.fillRect(b.xy[k] - o, b.xy[k + 1] - o, sz, sz);
    });
    // Posts: arcs that rise off the surface between two places, a bright head running along each.
    ctx.lineWidth = 1.4;
    for (const arc of arcs) {
      if (dt) arc.t += dt * 0.25;
      if (arc.t > 1.4) { arc.a = arcs.pick(); arc.b = arcs.pick(); arc.t = 0; }
      project(arc.a, p); project(arc.b, q);
      if (p[2] < 0 || q[2] < 0) continue;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, lift = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.45;
      const ox = mx + ((mx - cx) / R) * lift, oy = my + ((my - cy) / R) * lift;
      const k = Math.min(1, arc.t);
      ctx.strokeStyle = `rgba(255,120,200,${0.55 * (1 - Math.max(0, arc.t - 1) / 0.4)})`;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      for (let s = 1; s <= 20; s++) { const u = (s / 20) * k; ctx.lineTo((1 - u) ** 2 * p[0] + 2 * (1 - u) * u * ox + u * u * q[0], (1 - u) ** 2 * p[1] + 2 * (1 - u) * u * oy + u * u * q[1]); }
      ctx.stroke();
      const hx = (1 - k) ** 2 * p[0] + 2 * (1 - k) * k * ox + k * k * q[0], hy = (1 - k) ** 2 * p[1] + 2 * (1 - k) * k * oy + k * k * q[1];
      ctx.fillStyle = '#ffd1ee'; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, 7); ctx.fill();
    }
  };
  return { setup, frame };
}

// --- Web Development: a field of faint code glyphs that wake up and churn around the cursor.
const CODE = '{}<>/=;:()[]+*01#$&_.';
function web() {
  let base = null, cols = 0, rows = 0;
  const CW = 12, CH = 18;
  const setup = (w, h) => {
    cols = Math.ceil(w / CW); rows = Math.ceil(h / CH);
    base = sheet(w, h);
    const x = base.getContext('2d');
    x.fillStyle = '#05080a'; x.fillRect(0, 0, w, h);
    x.font = '12px "IBM Plex Mono", ui-monospace, monospace'; x.textBaseline = 'top';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      x.fillStyle = `rgba(125,255,189,${0.05 + Math.random() * 0.07})`;
      x.fillText(CODE[(Math.random() * CODE.length) | 0], i * CW, j * CH);
    }
  };
  const frame = (ctx, w, h, dt, t) => {
    ctx.drawImage(base, 0, 0, w, h);
    if (pointer.x < -1e3) return;
    ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
    const R = 170, i0 = Math.max(0, Math.floor((pointer.x - R) / CW)), i1 = Math.min(cols, Math.ceil((pointer.x + R) / CW));
    const j0 = Math.max(0, Math.floor((pointer.y - R) / CH)), j1 = Math.min(rows, Math.ceil((pointer.y + R) / CH)), tick = Math.floor(t * 12);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const d = Math.hypot(i * CW - pointer.x, j * CH - pointer.y) / R;
      if (d > 1) continue;
      ctx.fillStyle = '#05080a'; ctx.fillRect(i * CW, j * CH, CW, CH);
      ctx.fillStyle = `rgba(125,255,189,${(1 - d) * 0.9})`;
      ctx.fillText(CODE[(i * 31 + j * 17 + tick) % CODE.length], i * CW, j * CH);
    }
  };
  return { setup, frame };
}

export const SCENES = { aerodynamics: aero, avionics, design, 'social-media': social, 'web-development': web };

// Runs one scene on a canvas: the same code in the worker and on the page. Messages in:
//   resize {w, h} · move {x, y, t} · hover {x, y} · down {x, y} · up · visible {on} · destroy
// out: shown (first frame drawn) · cursor {value}
const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((f) => setTimeout(() => f(performance.now()), 16));
const unraf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
export function createRunner(canvas, { slug, w, h, still }, post) {
  const scene = SCENES[slug](), ctx = canvas.getContext('2d');
  let loop = 0, last = performance.now(), visible = true, dead = false, shown = false;
  const t0 = last;
  const show = () => { if (!shown) { shown = true; post({ type: 'shown' }); } };
  const size = (nw, nh) => {
    w = nw; h = nh; canvas.width = w; canvas.height = h; // one pixel per CSS pixel: the scene sits under a wash of the page colour
    scene.setup?.(w, h);
    if (still) { scene.frame(ctx, w, h, 0, 3); show(); }
  };
  // 30 frames a second: slow scenes under a wash of the page colour; half the frames is half the work.
  const tick = (now) => {
    loop = visible && !dead ? raf(tick) : 0;
    if (now - last < 30) return;
    // A frame's timestamp can predate the one taken when the loop started: never let time run backwards, and
    // never pass 0, which the scenes read as "draw a still frame" (seconds of work for Aerodynamics).
    scene.frame(ctx, w, h, Math.max(0.001, Math.min(0.05, (now - last) / 1000)), Math.max(0, (now - t0) / 1000));
    last = Math.max(last, now);
    show();
  };
  const wake = () => { if (!still && !loop && visible && !dead) { last = performance.now(); loop = raf(tick); } };
  size(w, h); wake();
  return {
    handle(m) {
      if (dead) return;
      if (m.type === 'resize') size(m.w, m.h);
      else if (m.type === 'move') trackAt(m.x, m.y, m.t);
      else if (m.type === 'hover') post({ type: 'cursor', value: scene.hover?.(m.x, m.y) || '' });
      else if (m.type === 'down') { if (scene.onDown?.(m.x, m.y) && still) scene.frame(ctx, w, h, 0, 3); }
      else if (m.type === 'up') scene.onUp?.();
      else if (m.type === 'visible') { visible = m.on; wake(); }
      else if (m.type === 'destroy') { dead = true; unraf(loop); }
    },
  };
}
