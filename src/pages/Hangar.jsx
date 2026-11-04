import { useEffect, useRef, useState } from 'react';
import { SheetHead } from '../components/Layout';

// "Payload Run", the hidden game behind the footer's "secret" link.
// Hold (mouse, touch or Space) to climb; climbing drains the battery. Collect payload crates,
// pick up cells to recharge, keep clear of the pylons, the ground and the altitude ceiling.
const W = 960, H = 540, PLANE_X = 220, CEIL = 40, GROUND = H - 48;
const KEY = 'payload-best';
const best = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };

function fresh() {
  return { y: H / 2, vy: 0, t: 0, dist: 0, speed: 4.2, kg: 0, battery: 1, items: [], next: 60, gust: 0, over: false };
}

// Pylons come in pairs with a gap; crates and cells float in the gaps and between them.
function spawn(s) {
  const gap = Math.max(150, 230 - s.dist / 400);
  const top = CEIL + 30 + Math.random() * (GROUND - CEIL - gap - 60);
  s.items.push({ kind: 'pylon', x: W + 40, top, gap, w: 26 });
  s.items.push({ kind: Math.random() < 0.28 ? 'cell' : 'crate', x: W + 40 + 13, y: top + gap / 2, r: 13 });
  if (Math.random() < 0.5) s.items.push({ kind: 'crate', x: W + 40 + 200, y: CEIL + 60 + Math.random() * (GROUND - CEIL - 120), r: 13 });
  s.next = Math.max(70, 120 - s.dist / 300);
}

function draw(ctx, s, c, k = 1) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  // Graph-paper grid scrolling with the flight.
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  const off = -(s.dist % 40);
  for (let x = off; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // Ceiling and ground.
  ctx.strokeStyle = c.signal; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, CEIL); ctx.lineTo(W, CEIL); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.ink; ctx.fillRect(0, GROUND, W, 2);
  for (let x = off * 2 % 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, GROUND + 2); ctx.lineTo(x - 10, GROUND + 14); ctx.strokeStyle = c.ink2; ctx.stroke(); }

  for (const it of s.items) {
    if (it.kind === 'pylon') {
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5;
      ctx.strokeRect(it.x, CEIL, it.w, it.top - CEIL);
      ctx.strokeRect(it.x, it.top + it.gap, it.w, GROUND - it.top - it.gap);
      ctx.lineWidth = 1;
      for (const [a, b] of [[CEIL, it.top], [it.top + it.gap, GROUND]]) for (let y = a; y < b - 12; y += 16) {
        ctx.beginPath(); ctx.moveTo(it.x, y); ctx.lineTo(it.x + it.w, y + 12); ctx.stroke();
      }
    } else if (!it.got) {
      ctx.lineWidth = 1.5;
      if (it.kind === 'crate') {
        ctx.strokeStyle = c.signal; ctx.strokeRect(it.x - 11, it.y - 11, 22, 22);
        ctx.beginPath(); ctx.moveTo(it.x - 11, it.y - 11); ctx.lineTo(it.x + 11, it.y + 11); ctx.moveTo(it.x + 11, it.y - 11); ctx.lineTo(it.x - 11, it.y + 11); ctx.stroke();
      } else {
        ctx.strokeStyle = c.ink; ctx.strokeRect(it.x - 7, it.y - 12, 14, 24); ctx.fillStyle = c.ink; ctx.fillRect(it.x - 3, it.y - 15, 6, 3);
        ctx.fillRect(it.x - 5, it.y + 2, 10, 8);
      }
    }
  }

  // The aircraft, side view, pitched with its climb rate.
  ctx.save(); ctx.translate(PLANE_X, s.y); ctx.rotate(Math.max(-0.5, Math.min(0.5, s.vy / 14)));
  ctx.strokeStyle = c.ink; ctx.lineWidth = 1.75; ctx.fillStyle = c.sheet;
  ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(30, -7, 10, -7); ctx.lineTo(-38, -3); ctx.lineTo(-38, 2); ctx.lineTo(10, 6); ctx.quadraticCurveTo(30, 6, 34, 0); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, -3); ctx.lineTo(-42, -18); ctx.lineTo(-36, -18); ctx.lineTo(-22, -3); ctx.stroke(); // fin
  ctx.fillStyle = c.signal; ctx.fillRect(-4, -9, 26, 4); // wing, end on
  ctx.beginPath(); ctx.moveTo(36, -9); ctx.lineTo(36, 9); ctx.stroke(); // propeller
  ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(0, 16); ctx.moveTo(18, 6); ctx.lineTo(20, 16); ctx.stroke(); // gear
  ctx.restore();

  // Instruments.
  // k scales the readouts up when the canvas is drawn small (phones).
  ctx.font = `500 ${15 * k}px "IBM Plex Mono", monospace`; ctx.fillStyle = c.ink; ctx.textBaseline = 'top';
  ctx.fillText(`${String(Math.floor(s.dist / 10)).padStart(5, '0')} m`, 20, 10);
  ctx.fillText(`${s.kg.toFixed(1)} kg`, 20 + 110 * k, 10);
  const bx = 20 + 210 * k, bw = 90 * k;
  ctx.lineWidth = 1.5; ctx.strokeStyle = c.ink; ctx.strokeRect(bx, 10, bw, 14 * k);
  ctx.fillStyle = s.battery < 0.2 ? c.signal : c.ink; ctx.fillRect(bx + 2, 12, (bw - 4) * s.battery, 14 * k - 4);
  ctx.fillStyle = c.ink2; ctx.textAlign = 'right'; ctx.fillText(`BEST ${best()}`, W - 20, 10); ctx.textAlign = 'left';
}

const score = (s) => Math.floor(s.dist / 10 + s.kg * 50);

export default function Hangar() {
  const canvas = useRef(null);
  const [state, setState] = useState('ready'); // ready | flying | over
  const [result, setResult] = useState(null);
  const game = useRef(fresh());
  const hold = useRef(false);

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const c = { paper: v('--color-paper'), sheet: v('--color-sheet'), ink: v('--color-ink'), ink2: v('--color-ink-2'), signal: v('--color-signal'), grid: v('--fig-grid') || v('--color-rule') };
    let raf, last = performance.now();
    const step = (now) => {
      const dt = Math.min(2, (now - last) / 16.67); last = now;
      const s = game.current;
      if (state === 'flying' && !s.over) {
        const up = hold.current && s.battery > 0;
        s.vy += (up ? -0.55 : 0.38) * dt + s.gust * dt;
        s.vy = Math.max(-7, Math.min(8, s.vy)) * 0.985;
        s.y += s.vy * dt;
        s.battery = Math.max(0, Math.min(1, s.battery - (up ? 0.0035 : -0.0006) * dt));
        s.speed = 4.2 + s.dist / 4000;
        s.dist += s.speed * dt;
        if (Math.random() < 0.01) s.gust = (Math.random() - 0.5) * 0.25;
        s.gust *= 0.99;
        for (const it of s.items) it.x -= s.speed * dt;
        s.items = s.items.filter((it) => it.x > -60);
        if ((s.next -= s.speed * dt / 4.2) <= 0) spawn(s);
        for (const it of s.items) {
          if (it.kind === 'pylon') {
            const inX = PLANE_X + 34 > it.x && PLANE_X - 38 < it.x + it.w;
            if (inX && (s.y - 8 < it.top || s.y + 8 > it.top + it.gap)) s.over = 'Clipped a pylon';
          } else if (!it.got && Math.hypot(it.x - PLANE_X, it.y - s.y) < it.r + 18) {
            it.got = true;
            if (it.kind === 'crate') s.kg += 0.5; else s.battery = Math.min(1, s.battery + 0.35);
          }
        }
        if (s.y + 14 > GROUND) s.over = 'Hit the ground';
        if (s.y - 10 < CEIL) s.over = 'Broke the altitude ceiling';
        if (s.over) {
          const sc = score(s);
          try { if (sc > best()) localStorage.setItem(KEY, sc); } catch { /* private mode */ }
          setResult({ why: s.over, score: sc, kg: s.kg, dist: Math.floor(s.dist / 10) });
          setState('over');
        }
      }
      draw(ctx, game.current, c, Math.min(2.2, Math.max(1, (W / canvas.current.clientWidth) * 0.7)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const start = () => { game.current = fresh(); hold.current = false; setResult(null); setState('flying'); };
  useEffect(() => {
    const down = (e) => { if (e.code !== 'Space') return; e.preventDefault(); if (state !== 'flying') start(); hold.current = true; };
    const up = (e) => { if (e.code === 'Space') hold.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  }, [state]);

  const press = (e) => { e.preventDefault(); if (state !== 'flying') { start(); } hold.current = true; };
  const release = () => { hold.current = false; };

  return (
    <>
      <SheetHead title="Payload Run"><p>You found the hangar. Hold to climb, let go to sink. Collect payload, grab battery cells, and stay between the ground and the ceiling.</p></SheetHead>
      <section className="wrap py-10 grid gap-4">
        <div className="relative border border-ink select-none touch-none">
          <canvas ref={canvas} width={W} height={H} className="block w-full h-auto cursor-pointer"
            onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
            aria-label="Payload Run game. Press and hold, or hold Space, to climb." role="img" />
          {state !== 'flying' && (
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 text-center bg-paper/80 p-6 pointer-events-none">
              {result ? (
                <>
                  <p className="data text-signal">{result.why}</p>
                  <p className="display text-5xl md:text-6xl">{result.score}</p>
                  <p className="text-ink-2">{result.dist} m flown · {result.kg.toFixed(1)} kg delivered · best {best()}</p>
                </>
              ) : <p className="display text-4xl md:text-5xl">Ready for takeoff</p>}
              <p className="wide text-sm">Press and hold to {result ? 'fly again' : 'start'}</p>
            </div>
          )}
        </div>
        <p className="data text-ink-2">Score: one point per 10 m, fifty per kilogram of payload.</p>
      </section>
    </>
  );
}
