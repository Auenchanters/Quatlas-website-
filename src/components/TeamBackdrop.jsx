import { useEffect, useRef } from 'react';
import { Design, speedColour } from './TeamArt';
import { LAND } from '../content/land';

// The full-page background behind each subteam page, under a tint of the page colour so the text stays
// readable. The pointer is read from the window (the page content sits on top), so the backgrounds
// answer it anywhere. Drawing stops while the tab is hidden; with reduced motion each draws once (the
// avionics panel still redraws when a switch is flipped).

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };
const track = (e) => { const now = performance.now(), dt = Math.max(8, now - pointer.t); pointer.vx = (e.clientX - pointer.x) / dt; pointer.vy = (e.clientY - pointer.y) / dt; pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = now; };

// Clicks and hover reach the background anywhere except on the page's own controls (links, buttons, fields).
const bare = (el) => !el.closest?.('a, button, input, select, textarea, label, dialog, .pullcord');

// A fixed canvas the size of the window. setup(w, h) runs on every resize; frame(ctx, w, h, dt, t) draws.
function useBackdrop({ setup, frame, onClick, hover }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d');
    let raf = 0, w = 0, h = 0, last = performance.now();
    const t0 = last, once = still();
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setup?.(w, h);
      if (once) frame(ctx, w, h, 0, 3);
    };
    const loop = (now) => {
      raf = document.hidden ? 0 : requestAnimationFrame(loop);
      frame(ctx, w, h, Math.min(0.05, (now - last) / 1000), (now - t0) / 1000); last = now;
    };
    const wake = () => { if (!document.hidden && !raf && !once) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const click = (e) => { if (onClick && bare(e.target) && onClick(e.clientX, e.clientY) && once) frame(ctx, w, h, 0, 3); };
    const move = (e) => { track(e); if (hover) document.documentElement.style.cursor = bare(e.target) && hover(e.clientX, e.clientY) ? 'pointer' : ''; };
    size(); wake();
    addEventListener('resize', size); addEventListener('pointermove', move, { passive: true }); addEventListener('click', click);
    document.addEventListener('visibilitychange', wake);
    return () => {
      cancelAnimationFrame(raf); raf = 0; document.documentElement.style.cursor = '';
      removeEventListener('resize', size); removeEventListener('pointermove', move); removeEventListener('click', click);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [setup, frame, onClick, hover]);
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
}

// --- Aerodynamics: a live flow field. Particles stream left to right past a wing section and around the
// cursor, which acts as a body in the flow (potential flow around cylinders); streaks are coloured by speed.
function aero() {
  let parts = [], bodies = [], fresh = true;
  const U = 90; // freestream, px per second
  const spawn = (p, w, h, anywhere) => { p.x = anywhere ? Math.random() * w : -Math.random() * 40; p.y = Math.random() * h; p.age = 0; p.life = 4 + Math.random() * 6; return p; };
  const setup = (w, h) => {
    parts = Array.from({ length: Math.min(1600, Math.round((w * h) / 1100)) }, () => spawn({}, w, h, true));
    fresh = true; // a resize clears the canvas: start from a solid field, not transparent
    // The fixed body: a row of doublets along a chord, a crude wing section at right of centre.
    const cx = w * 0.66, cy = h * 0.56, chord = Math.min(w, h) * 0.42;
    bodies = Array.from({ length: 6 }, (_, i) => ({ x: cx - chord / 2 + (i / 5) * chord, y: cy + Math.sin((i / 5) * Math.PI) * -10, R: (1 - Math.abs(i / 5 - 0.3)) * chord * 0.09 + 6 }));
  };
  const vel = (x, y, out) => {
    let u = U, v = 0;
    const all = pointer.x > -1e3 ? [...bodies, { x: pointer.x, y: pointer.y, R: 64 }] : bodies;
    for (const b of all) {
      const dx = x - b.x, dy = y - b.y, r2 = dx * dx + dy * dy, R2 = b.R * b.R;
      if (r2 < R2) { const r = Math.sqrt(r2) || 1; u += (dx / r) * U * 3; v += (dy / r) * U * 3; continue; }
      const r4 = r2 * r2;
      u -= (U * R2 * (dx * dx - dy * dy)) / r4; v -= (2 * U * R2 * dx * dy) / r4;
    }
    out[0] = u; out[1] = v; return out;
  };
  const buckets = Array.from({ length: 7 }, () => []), uv = [0, 0];
  const frame = (ctx, w, h, dt) => {
    ctx.fillStyle = 'rgba(6, 16, 46, 0.12)'; ctx.fillRect(0, 0, w, h); // streaks fade: the trails
    if (!dt || fresh) { ctx.fillStyle = '#06102e'; ctx.fillRect(0, 0, w, h); fresh = false; }
    for (const b of buckets) b.length = 0;
    const steps = dt ? 1 : 120; // a still frame integrates the streaks in one go
    for (const p of parts) {
      for (let s = 0; s < steps; s++) {
        const x0 = p.x, y0 = p.y;
        vel(p.x, p.y, uv);
        const d = dt || 1 / 60;
        p.x += uv[0] * d; p.y += uv[1] * d; p.age += d;
        const sp = Math.hypot(uv[0], uv[1]) / U;
        buckets[Math.max(0, Math.min(6, Math.round(((sp - 0.4) / 1.4) * 6)))].push(x0, y0, p.x, p.y);
        if (p.x > w + 10 || p.y < -20 || p.y > h + 20 || p.age > p.life) { spawn(p, w, h, false); break; }
      }
    }
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    buckets.forEach((seg, i) => {
      if (!seg.length) return;
      ctx.strokeStyle = speedColour(i / 6); ctx.beginPath();
      for (let k = 0; k < seg.length; k += 4) { ctx.moveTo(seg[k], seg[k + 1]); ctx.lineTo(seg[k + 2], seg[k + 3]); }
      ctx.stroke();
    });
    // The wing section the flow parts around: a symmetric NACA four-digit profile over the doublets.
    const le = bodies[0].x - bodies[0].R, c = bodies.at(-1).x - le + bodies.at(-1).R * 0.4, yc = bodies[2].y, th = (bodies[1].R * 2.2) / c;
    const half = (u) => 5 * th * c * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4);
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const u = (k / 40) ** 2; ctx.lineTo(le + u * c, yc - half(u)); }
    for (let k = 40; k >= 0; k--) { const u = (k / 40) ** 2; ctx.lineTo(le + u * c, yc + half(u)); }
    ctx.fillStyle = 'rgba(10, 20, 50, 0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(230, 240, 255, 0.5)'; ctx.lineWidth = 1; ctx.stroke();
  };
  return { setup, frame };
}

// --- Avionics: a radar station with working switches and buttons. RADAR powers the scope, IFF marks
// contacts friendly, WX paints weather, ARM turns the scope amber, NAV LT blinks the lights, A/P turns
// the heading rose. RNG +/− change the range, MODE switches full scan and sector, CLR clears contacts;
// clicking the scope drops a contact there.
function avionics() {
  const st = { radar: true, iff: false, wx: false, arm: false, nav: true, ap: true, range: 1, sector: false, contacts: [], press: {}, sweep: 0, hdg: 0 };
  const RANGES = [10, 20, 40, 80];
  let L = null; // layout, recomputed on resize
  const setup = (w, h) => {
    const R = Math.min(w * 0.27, h * 0.33), cx = w * 0.68, cy = h * 0.44;
    // One console row along the bottom, right-aligned under the scope: six switches, then four buttons.
    const step = Math.min(96, w * 0.075), x0 = Math.max(16, w - 32 - (6 * step + 24 + 4 * 82));
    const SW = [['radar', 'RADAR'], ['iff', 'IFF'], ['wx', 'WX'], ['arm', 'MASTER ARM'], ['nav', 'NAV LT'], ['ap', 'A/P']].map(([k, label], i) => ({ x: x0 + i * step, y: h - 112, w: 46, h: 74, k, label }));
    const BT = [['rng+', 'RNG +'], ['rng-', 'RNG −'], ['mode', 'MODE'], ['clr', 'CLR']].map(([k, label], i) => ({ x: x0 + 6 * step + 24 + i * 82, y: h - 97, w: 70, h: 44, k, label }));
    L = { R, cx, cy, SW, BT };
    if (!st.contacts.length) st.contacts = Array.from({ length: 6 }, () => ({ a: Math.random() * Math.PI * 2, r: 0.25 + Math.random() * 0.7, seen: -9, friend: Math.random() < 0.4 }));
  };
  const hit = (x, y) => {
    if (!L) return null;
    for (const s of [...L.SW, ...L.BT]) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    if (Math.hypot(x - L.cx, y - L.cy) < L.R) return { k: 'scope' };
    return null;
  };
  const onClick = (x, y) => {
    const s = hit(x, y);
    if (!s) return false;
    if (s.k in st && typeof st[s.k] === 'boolean') st[s.k] = !st[s.k];
    st.press[s.k] = performance.now();
    if (s.k === 'rng+') st.range = Math.min(RANGES.length - 1, st.range + 1);
    if (s.k === 'rng-') st.range = Math.max(0, st.range - 1);
    if (s.k === 'mode') st.sector = !st.sector;
    if (s.k === 'clr') st.contacts = [];
    if (s.k === 'scope' && st.radar) {
      const a = Math.atan2(y - L.cy, x - L.cx), r = Math.hypot(x - L.cx, y - L.cy) / L.R;
      st.contacts.push({ a, r, seen: performance.now() / 1000, friend: st.iff });
    }
    return true;
  };
  const hover = (x, y) => !!hit(x, y);
  const frame = (ctx, w, h, dt, t) => {
    const { R, cx, cy, SW, BT } = L, now = performance.now();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#151a22'); g.addColorStop(1, '#07090c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Panel seams and rivets.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 240) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 12; x < w; x += 240) for (let y = 12; y < h; y += 60) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
    // The scope.
    const ink = st.arm ? '255,176,46' : '61,255,154';
    ctx.fillStyle = '#030605'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a4150'; ctx.lineWidth = 6; ctx.stroke();
    const on = st.radar, span = st.sector ? Math.PI * 2 / 3 : Math.PI * 2;
    if (on && dt) st.sweep += dt * (st.sector ? 1.6 : 1.9);
    const ang = st.sector ? -Math.PI / 2 + Math.sin(st.sweep) * span / 2 : st.sweep % (Math.PI * 2);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    if (on) {
      ctx.strokeStyle = `rgba(${ink},0.28)`; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, 7); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.fillStyle = `rgba(${ink},0.6)`; ctx.font = '11px "IBM Plex Mono", monospace';
      for (let i = 1; i <= 4; i++) ctx.fillText(`${(RANGES[st.range] * i) / 4}`, cx + 4, cy - (R * i) / 4 + 12);
      if (st.wx) for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + 0.4, r = R * (0.35 + 0.1 * i), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const wg = ctx.createRadialGradient(x, y, 0, x, y, R * 0.18); wg.addColorStop(0, 'rgba(255,80,60,0.45)'); wg.addColorStop(0.5, 'rgba(255,210,60,0.25)'); wg.addColorStop(1, 'rgba(60,255,120,0)');
        ctx.fillStyle = wg; ctx.fillRect(x - R * 0.2, y - R * 0.2, R * 0.4, R * 0.4);
      }
      // The sweep: a fading wedge behind the beam.
      for (let k = 0; k < 24; k++) {
        ctx.fillStyle = `rgba(${ink},${0.22 * (1 - k / 24)})`; ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, ang - (k + 1) * 0.025, ang - k * 0.025); ctx.fill();
      }
      ctx.strokeStyle = `rgba(${ink},0.95)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
      for (const c of st.contacts) {
        const diff = ((ang - c.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.08) c.seen = t;
        const glow = Math.max(0, 1 - (t - c.seen) / 3);
        if (glow <= 0) continue;
        const x = cx + Math.cos(c.a) * c.r * R, y = cy + Math.sin(c.a) * c.r * R;
        ctx.fillStyle = c.friend ? `rgba(80,200,255,${glow})` : `rgba(${ink},${glow})`;
        if (c.friend) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); } else ctx.fillRect(x - 5, y - 5, 10, 10);
      }
    }
    ctx.restore();
    // Heading rose around the scope.
    if (st.ap && dt) st.hdg += dt * 0.08;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-st.hdg);
    ctx.strokeStyle = on ? 'rgba(56,215,255,0.7)' : 'rgba(120,130,140,0.4)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, l = i % 6 ? 6 : 14; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R + 18), Math.sin(a) * (R + 18)); ctx.lineTo(Math.cos(a) * (R + 18 + l), Math.sin(a) * (R + 18 + l)); ctx.stroke(); }
    ctx.restore();
    // Buttons: lit while pressed and while their mode is on.
    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of BT) {
      const lit = now - (st.press[b.k] ?? -1e4) < 250 || (b.k === 'mode' && st.sector);
      ctx.fillStyle = lit ? '#2b4a3a' : '#1c212a'; ctx.strokeStyle = '#4a5262'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = lit ? '#7dffbd' : '#9aa3b2'; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
    // Toggle switches with guards, labels and a status lamp.
    for (const s of SW) {
      const up = st[s.k];
      ctx.fillStyle = '#1a1e26'; ctx.strokeStyle = '#3a4150'; ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, s.h, 6); ctx.fill(); ctx.stroke();
      const mx = s.x + s.w / 2, my = s.y + s.h / 2 - 6;
      ctx.fillStyle = '#5b6372'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d7dbe2'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my + (up ? -22 : 22)); ctx.stroke(); ctx.lineCap = 'butt';
      const blink = s.k === 'nav' && up ? Math.sin(t * 6) > 0 : up;
      ctx.fillStyle = blink ? (s.k === 'arm' ? '#ffb02e' : '#3dff9a') : '#2a2f38'; ctx.beginPath(); ctx.arc(mx, s.y + s.h - 9, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#9aa3b2'; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.fillText(s.label, mx, s.y + s.h + 14);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  };
  return { setup, frame, onClick, hover };
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
  const frame = (ctx, w, h, dt, t) => {
    const { cx, cy, R } = G;
    ctx.fillStyle = '#04060d'; ctx.fillRect(0, 0, w, h);
    for (const [x, y, s] of stars) { ctx.fillStyle = `rgba(200,215,255,${0.2 + s * 0.5 * (0.6 + 0.4 * Math.sin(t * 2 + s * 9))})`; ctx.fillRect(x, y, 1.4, 1.4); }
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
    for (const d of dots) {
      project(d, p);
      if (p[2] < -0.2) continue;
      const s = p[2] > 0 ? 1.1 + p[2] * 1.4 : 0.9;
      ctx.fillStyle = p[2] > 0 ? `rgba(120,190,255,${0.35 + p[2] * 0.65})` : 'rgba(120,190,255,0.08)';
      ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
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
    base = document.createElement('canvas'); base.width = w; base.height = h;
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

// Each scene is created once per mount (it keeps its own state: particles, switch positions).
function Scene({ make }) {
  const scene = useRef(null);
  scene.current ??= make();
  return useBackdrop(scene.current);
}

const SCENES = { aerodynamics: aero, avionics, 'social-media': social, 'web-development': web };

export default function TeamBackdrop({ slug }) {
  const make = SCENES[slug];
  if (!make && slug !== 'design') return null;
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      {slug === 'design' ? <div className="absolute -inset-[10%]"><Design /></div> : <Scene key={slug} make={make} />}
      {/* The page colour over it, so text stays readable; the scene shows through. */}
      <div className="absolute inset-0 bg-paper/55 pointer-events-none" />
    </div>
  );
}

// Web Development's text decodes out of scrambled code as it scrolls into view, each run of text
// resolving left to right. Headings with their own word reveal are left to it. Returns a cleanup.
export function decodeOnScroll(root) {
  if (still()) return () => {};
  const glyph = () => CODE[(Math.random() * CODE.length) | 0];
  const runs = new Map(); // element → its text nodes and their real text
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('[data-reveal="words"], script, style, svg, canvas') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!runs.has(el)) runs.set(el, []);
    runs.get(el).push({ n, text: n.nodeValue });
  }
  const scramble = (text, upto) => [...text].map((ch, i) => (i < upto || ch === ' ' ? ch : glyph())).join('');
  for (const list of runs.values()) for (const r of list) { r.shown = scramble(r.text, 0); r.n.nodeValue = r.shown; }
  const timers = new Set();
  const play = (list) => {
    const len = Math.max(...list.map((r) => r.text.length)), dur = Math.min(900, 250 + len * 14), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      for (const r of list) {
        if (r.n.nodeValue !== r.shown) continue; // React changed it meanwhile: leave React's text alone
        r.shown = k < 1 ? scramble(r.text, Math.floor(k * r.text.length)) : r.text;
        r.n.nodeValue = r.shown;
      }
      if (k < 1) { const id = requestAnimationFrame(step); timers.add(id); }
    };
    timers.add(requestAnimationFrame(step));
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); play(runs.get(e.target)); }
  }, { rootMargin: '0px 0px -8% 0px' });
  runs.forEach((_, el) => io.observe(el));
  return () => {
    io.disconnect(); timers.forEach(cancelAnimationFrame);
    for (const list of runs.values()) for (const r of list) if (r.n.nodeValue === r.shown) r.n.nodeValue = r.text;
  };
}
