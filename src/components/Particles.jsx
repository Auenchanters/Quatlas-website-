import { useEffect, useRef } from 'react';

// One canvas behind the page that answers the cursor.
// Night: the old site's star field, three depths drifting upward; the stars follow the cursor in parallax,
// part around it, and the ones close to it join into constellation lines.
// Day: drafting crosses on the sheet's grid that lean away from the cursor and pick up the signal red.
const R = 140; // cursor reach, px

export default function Particles() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    let ctx = null; // created on first interaction: canvas set-up is the costly part
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
    let W = 0, H = 0, stars = [], winds = [], color = {}, raf = 0, idle = 0, last = 0, running = false, lastInput = 0;

    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      color = { ink: s.getPropertyValue('--color-ink').trim(), rule: s.getPropertyValue('--color-rule').trim(), signal: s.getPropertyValue('--color-signal').trim() };
    };
    const dark = () => document.documentElement.dataset.theme === 'dark';

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((W * H) / 6500) }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: [0.35, 0.65, 1][(Math.random() * 3) | 0], ox: 0, oy: 0, tw: Math.random() * 6.28,
      }));
      winds = Array.from({ length: 40 }, () => wind(true));
    }

    // Night wind: faint streaks drifting up and to the right at 28°, like airflow past the page.
    const WX = Math.cos(0.49), WY = -Math.sin(0.49);
    function wind(anywhere) {
      const w = { v: 20 + Math.random() * 40, len: 60 + Math.random() * 100, a: 0.04 + Math.random() * 0.08 };
      if (anywhere) return { ...w, x: Math.random() * W, y: Math.random() * H };
      return Math.random() < 0.5 ? { ...w, x: -w.len, y: Math.random() * H } : { ...w, x: Math.random() * W, y: H + w.len };
    }
    function drawWind(dt) {
      ctx.strokeStyle = color.ink;
      ctx.lineWidth = 1;
      for (let i = 0; i < winds.length; i++) {
        const w = winds[i];
        if (!still) { w.x += WX * w.v * dt / 1000; w.y += WY * w.v * dt / 1000; }
        if (w.x - WX * w.len > W || w.y - WY * w.len < 0) { winds[i] = wind(false); continue; }
        ctx.globalAlpha = w.a;
        ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - WX * w.len, w.y - WY * w.len); ctx.stroke();
      }
    }

    // Eases each point's offset toward "away from the cursor"; returns closeness 0..1.
    function push(p, x, y, strength) {
      const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
      const f = d < R ? (1 - d / R) ** 2 : 0;
      p.ox += ((f && (dx / d) * f * strength) - p.ox) * 0.12;
      p.oy += ((f && (dy / d) * f * strength) - p.oy) * 0.12;
      return f;
    }

    function drawStars(dt) {
      const near = [];
      const px = (mouse.x > -1e3 ? mouse.x - W / 2 : 0) * -0.03, py = (mouse.y > -1e3 ? mouse.y - H / 2 : 0) * -0.03;
      for (const s of stars) {
        if (!still) { s.y -= s.z * 0.012 * dt; if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; } s.tw += dt * 0.002; }
        const bx = s.x + px * s.z, by = s.y + py * s.z;
        const f = still ? 0 : push(s, bx, by, 46 * s.z);
        const x = bx + s.ox, y = by + s.oy, size = 0.6 + s.z * 1.1 + f * 1.2;
        ctx.globalAlpha = Math.min(1, 0.35 + s.z * 0.45 + Math.sin(s.tw) * 0.15 + f);
        ctx.fillStyle = f > 0.15 ? color.signal : color.ink;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        if (f > 0.05) near.push([x, y, f]);
      }
      ctx.strokeStyle = color.ink;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          const [x1, y1, f1] = near[i], [x2, y2, f2] = near[j], d = Math.hypot(x2 - x1, y2 - y1);
          if (d > 90) continue;
          ctx.globalAlpha = Math.min(f1, f2) * (1 - d / 90) * 1.6;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
    }

    // Crosses keep their own offsets in a map keyed by grid cell, so they stay put while the page scrolls.
    const crosses = new Map();
    function drawCrosses() {
      const S = 36, top = -(scrollY % S);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color.rule;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const hot = [];
      for (let y = top; y < H + S; y += S) {
        const row = Math.round((y + scrollY) / S);
        for (let x = S / 2; x < W + S; x += S) {
          const key = row * 1000 + Math.round(x / S);
          let p = crosses.get(key);
          const inReach = !still && Math.abs(x - mouse.x) < R && Math.abs(y - mouse.y) < R;
          let f = 0;
          if (p || inReach) {
            if (!p) crosses.set(key, (p = { ox: 0, oy: 0 }));
            f = push(p, x, y, 16);
            if (!f && Math.abs(p.ox) < 0.05 && Math.abs(p.oy) < 0.05) crosses.delete(key);
          }
          if (f > 0.08) { hot.push([x + p.ox, y + p.oy, f]); continue; }
          const cx = x + (p?.ox ?? 0), cy = y + (p?.oy ?? 0);
          ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
        }
      }
      ctx.stroke();
      // Near the cursor the crosses turn red and rotate toward an ×, like marks under a loupe.
      ctx.strokeStyle = color.signal;
      for (const [x, y, f] of hot) {
        const a = f * Math.PI / 4, l = 3 + f * 3, c = Math.cos(a) * l, s = Math.sin(a) * l;
        ctx.globalAlpha = 0.4 + f * 0.6;
        ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.moveTo(x + s, y - c); ctx.lineTo(x - s, y + c); ctx.stroke();
      }
    }

    function frame(now) {
      const dt = Math.min(64, now - last);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * (mouse.tx < -1e3 ? 1 : 0.18);
      mouse.y += (mouse.ty - mouse.y) * (mouse.ty < -1e3 ? 1 : 0.18);
      ctx.clearRect(0, 0, W, H);
      if (dark()) { drawWind(dt); drawStars(dt); } else drawCrosses();
      ctx.globalAlpha = 1;
      // Stars drift for ever; the crosses only redraw while the cursor or a displaced cross is still moving.
      running = !still && !document.hidden && (dark() || crosses.size > 0 || now - lastInput < 400);
      if (!running) return;
      // With the cursor idle the stars only drift, ~1 px a frame at 12 fps; full rate returns when it moves.
      if (now - lastInput > 1500 && dark()) idle = setTimeout(() => { idle = 0; raf = requestAnimationFrame(frame); }, 80);
      else raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };

    const onMove = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; lastInput = performance.now(); if (started) { if (idle) { clearTimeout(idle); idle = 0; running = false; } kick(); } };
    const onLeave = () => { mouse.tx = mouse.ty = -1e4; };
    const onVisible = () => { if (document.hidden) { cancelAnimationFrame(raf); running = false; } else if (started) kick(); };
    const onResize = () => { if (started) { resize(); kick(); } };
    const onScroll = () => { lastInput = performance.now(); if (started) kick(); }; // the grid scrolls with the sheet
    const themeWatch = new MutationObserver(() => { readColors(); if (started) { lastInput = performance.now(); kick(); } });

    // The field answers the cursor, so it is set up on the first move, scroll, tap or key and fades in;
    // nothing of it runs while the page is loading.
    let started = false;
    const WAKE = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'];
    const start = (e) => {
      // Chrome sends motionless "mousemove"s after layout while the pointer rests on the page; only real input counts.
      if (started || (e?.type === 'pointermove' && !e.movementX && !e.movementY)) return;
      if (document.readyState !== 'complete') return addEventListener('load', () => start(), { once: true });
      started = true;
      WAKE.forEach((e) => removeEventListener(e, start));
      ctx = canvas.getContext('2d');
      readColors();
      resize();
      canvas.style.opacity = '1';
      lastInput = performance.now();
      kick();
    };
    WAKE.forEach((e) => addEventListener(e, start, { passive: true }));
    themeWatch.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    addEventListener('resize', onResize);
    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      WAKE.forEach((e) => removeEventListener(e, start));
      themeWatch.disconnect();
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      removeEventListener('resize', onResize);
      removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ opacity: 0 }} className="fixed inset-0 -z-10 size-full pointer-events-none transition-opacity duration-1000" />;
}
