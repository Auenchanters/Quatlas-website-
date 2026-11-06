import { useEffect, useRef } from 'react';
import { Img } from './Img';

// The picture on each team tile, gently animated, all original and drawn in code (except the Social
// Media globe video and the Alumni photo of the college). Animations run only while a tile is on
// screen; with reduced motion each shows one still frame.

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// A canvas filling its tile, redrawn by draw(ctx, w, h, seconds) while visible (one frame if motion is reduced).
function useCanvas(draw, fps = 60) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d');
    let raf = 0, on = false, last = 0, w = 0, h = 0;
    const t0 = performance.now(), gap = 1000 / fps;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!on || still()) draw(ctx, w, h, still() ? 3 : (performance.now() - t0) / 1000);
    };
    const frame = (now) => {
      raf = on ? requestAnimationFrame(frame) : 0;
      if (now - last < gap - 1) return;
      last = now; draw(ctx, w, h, (now - t0) / 1000);
    };
    const io = new IntersectionObserver(([e]) => {
      on = e.isIntersecting && !still();
      if (on && !raf) raf = requestAnimationFrame(frame);
    });
    const ro = new ResizeObserver(size);
    ro.observe(c); io.observe(c); size();
    return () => { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
  }, [draw, fps]);
  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}

// --- Aerodynamics: CFD-style streamlines flowing past the 012, coloured by speed, over a deep blue field.
const SPEED = [[0, '#1d4fd8'], [0.25, '#18b8e6'], [0.5, '#29d17a'], [0.72, '#f3e64a'], [1, '#ff3b2f']];
const speedColour = (v) => {
  const i = SPEED.findIndex(([s]) => s >= v);
  if (i <= 0) return SPEED[0][1];
  const [a, ca] = SPEED[i - 1], [b, cb] = SPEED[i], t = (v - a) / (b - a);
  const p = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [x, y] = [p(ca), p(cb)];
  return `rgb(${x.map((n, k) => Math.round(n + (y[k] - n) * t)).join(',')})`;
};
let planeSprite = null; // the meshed planform, drawn once
function planform(w, h) {
  const c = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const s = h / 100, X = (v) => w * 0.5 + (v - 50) * s, Y = (v) => h * 0.5 + (v - 50) * s;
  // Top view, nose left: fuselage, the wide upper wing, the lower wing peeking ahead, the tail.
  const shapes = [
    [[8, 46], [62, 47.5], [96, 48.8], [96, 51.2], [62, 52.5], [8, 54]],
    [[30, 6], [42, 6], [44, 94], [30, 94]],
    [[22, 14], [32, 14], [32, 86], [22, 86]],
    [[82, 36], [92, 36], [94, 64], [82, 64]],
  ];
  const path = () => { x.beginPath(); for (const sh of shapes) sh.forEach(([a, b], i) => (i ? x.lineTo(X(a), Y(b)) : x.moveTo(X(a), Y(b)))); };
  const g = x.createRadialGradient(X(24), Y(50), 2, X(40), Y(50), 60 * s);
  g.addColorStop(0, '#ff4a2e'); g.addColorStop(0.08, '#f6e94c'); g.addColorStop(0.6, '#c9e64a'); g.addColorStop(1, '#58c95a');
  path(); x.fillStyle = g; x.fill('nonzero');
  // The surface mesh: a fine triangulated grid clipped to the airframe.
  x.save(); path(); x.clip('nonzero');
  x.strokeStyle = 'rgba(20,40,20,0.35)'; x.lineWidth = 0.5; x.beginPath();
  for (let i = -h; i < w + h; i += 5) { x.moveTo(i, 0); x.lineTo(i + h, h); x.moveTo(i, 0); x.lineTo(i - h * 0.6, h); }
  for (let j = 0; j < h; j += 5) { x.moveTo(0, j); x.lineTo(w, j); }
  x.stroke(); x.restore();
  path(); x.strokeStyle = 'rgba(10,20,10,0.6)'; x.lineWidth = 0.8; x.stroke();
  return c;
}
function drawAero(ctx, w, h, t) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c2a8a'); bg.addColorStop(1, '#3d8fe0');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const s = h / 100, cx = w * 0.5, cy = h * 0.5, nose = cx - 42 * s, wing = cx - 14 * s;
  const N = 34;
  ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const y0 = ((i + 0.5) / N - 0.5) * 2; // −1..1 across the field
    const pts = [];
    let vmax = 0;
    for (let k = 0; k <= 48; k++) {
      const px = (k / 48) * w, dxn = (px - nose) / (18 * s);
      // Pushed aside around the fuselage nose; a trailing tip vortex curls behind each wing tip.
      const bow = Math.sign(y0 || 1) * 9 * s * Math.exp(-dxn * dxn) * Math.exp(-((y0 / 0.18) ** 2));
      const tip = Math.exp(-(((Math.abs(y0) - 0.86) / 0.08) ** 2));
      const behind = Math.max(0, (px - wing) / (w - wing));
      const curl = tip * behind * 6 * s * Math.sin((px - wing) / (7 * s) - t * 3);
      const y = cy + y0 * h * 0.52 + bow + curl;
      const v = Math.min(1, 0.62 + Math.exp(-dxn * dxn) * 0.4 * Math.exp(-((y0 / 0.25) ** 2)) - tip * behind * 0.5 + Math.abs(y0) * 0.08);
      vmax = Math.max(vmax, v); pts.push([px, y, v]);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    pts.forEach(([px, , v], k) => k % 6 === 0 && g.addColorStop(px / w, speedColour(v)));
    ctx.strokeStyle = g;
    ctx.beginPath(); pts.forEach(([px, y], k) => (k ? ctx.lineTo(px, y) : ctx.moveTo(px, y)));
    ctx.globalAlpha = 0.35; ctx.setLineDash([]); ctx.stroke();
    ctx.globalAlpha = 0.95; ctx.setLineDash([10 * s, 7 * s]); ctx.lineDashOffset = -t * 26 * s - i * 3; ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (!planeSprite || planeSprite.w !== w || planeSprite.h !== h) planeSprite = Object.assign(planform(w, h), { w, h });
  ctx.drawImage(planeSprite, 0, 0, w, h);
}
function Aero() { return useCanvas(drawAero); }

// --- Avionics: a glass cockpit, three displays: attitude, radar sweep with contacts, heading and map.
function Avionics() {
  const bezel = (x, y, s) => Array.from({ length: 5 }, (_, i) => [
    <rect key={`t${i}`} x={x + 10 + i * (s - 20) / 4 - 4} y={y - 9} width="8" height="5" rx="1" className={i === 2 ? 'av-blink art-anim' : ''} fill={i === 2 ? '#ffb02e' : '#3a4150'} />,
    <rect key={`b${i}`} x={x + 10 + i * (s - 20) / 4 - 4} y={y + s + 4} width="8" height="5" rx="1" fill="#3a4150" />,
  ]);
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="av-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#262b35" /><stop offset="1" stopColor="#11141a" /></linearGradient>
        <linearGradient id="av-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3dff9a" stopOpacity="0" /><stop offset="1" stopColor="#3dff9a" stopOpacity="0.55" /></linearGradient>
        <clipPath id="av-adi"><rect x="22" y="62" width="76" height="76" rx="4" /></clipPath>
      </defs>
      <rect width="320" height="200" fill="url(#av-panel)" />
      {/* Anti-glare coaming and the up-front controls. */}
      <path d="M0 0H320V34L250 44H70L0 34Z" fill="#0b0d11" />
      <rect x="128" y="10" width="64" height="26" rx="3" fill="#1a1e26" stroke="#3a4150" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={133 + (i % 6) * 9.5} y={14 + Math.floor(i / 6) * 10} width="7" height="6" rx="1" fill={i === 4 ? '#3dff9a' : '#454d5c'} className={i === 4 ? 'av-blink art-anim' : ''} />)}
      {/* Left: attitude, a horizon that gently banks and pitches. */}
      <rect x="18" y="58" width="84" height="84" rx="6" fill="#06080b" stroke="#4a5262" />
      <g clipPath="url(#av-adi)">
        <g className="av-bank art-anim" style={{ transformOrigin: '60px 100px' }}>
          <rect x="-20" y="20" width="160" height="80" fill="#1f6fd1" /><rect x="-20" y="100" width="160" height="80" fill="#7a4b22" />
          <path d="M-20 100H140" stroke="#fff" strokeWidth="1.2" />
          {[-16, -8, 8, 16].map((d) => <path key={d} d={`M${d % 16 ? 52 : 46} ${100 + d}H${d % 16 ? 68 : 74}`} stroke="#fff" strokeWidth="0.8" />)}
        </g>
      </g>
      <path d="M44 100H54L58 104M76 100H66L62 104" stroke="#ffd23f" strokeWidth="2" fill="none" />
      {bezel(18, 58, 84)}
      {/* Centre: the radar, a sweep turning over range rings, contacts that glow as it passes. */}
      <rect x="114" y="54" width="92" height="92" rx="6" fill="#06080b" stroke="#4a5262" />
      {[14, 26, 38].map((r) => <circle key={r} cx="160" cy="100" r={r} fill="none" stroke="#1f7a4b" strokeWidth="0.7" />)}
      <path d="M160 60V140M120 100H200" stroke="#1f7a4b" strokeWidth="0.5" />
      <g className="av-sweep art-anim" style={{ transformOrigin: '160px 100px' }}>
        <path d="M160 100L198 100A38 38 0 0 0 186.9 73.1Z" fill="url(#av-sweep)" />
        <path d="M160 100H198" stroke="#7dffbd" strokeWidth="1" />
      </g>
      {[[178, 82, 0], [146, 120, 1.3], [172, 124, 2.4], [138, 86, 3.1]].map(([x, y, d]) => (
        <circle key={x} cx={x} cy={y} r="2.2" fill="#7dffbd" className="av-blip art-anim" style={{ animationDelay: `${d}s` }} />
      ))}
      {bezel(114, 54, 92)}
      {/* Right: heading rose turning slowly, and a moving-map track. */}
      <rect x="218" y="58" width="84" height="84" rx="6" fill="#06080b" stroke="#4a5262" />
      <g className="av-hdg art-anim" style={{ transformOrigin: '260px 100px' }}>
        <circle cx="260" cy="100" r="30" fill="none" stroke="#38d7ff" strokeWidth="0.8" />
        {Array.from({ length: 24 }, (_, i) => <path key={i} d="M260 70V75" stroke="#38d7ff" strokeWidth={i % 6 ? 0.6 : 1.4} transform={`rotate(${i * 15} 260 100)`} />)}
        <text x="260" y="82" fill="#38d7ff" fontSize="7" textAnchor="middle" fontFamily="monospace">N</text>
      </g>
      <path d="M260 92L264 104L260 101L256 104Z" fill="#fff" />
      <path d="M232 132Q250 118 262 124T290 112" stroke="#ff3dd2" strokeWidth="1" fill="none" strokeDasharray="3 2" />
      {bezel(218, 58, 84)}
      {/* Lower console. */}
      <rect x="40" y="160" width="240" height="40" rx="4" fill="#161a21" stroke="#2c323d" />
      {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={60 + i * 15} cy="176" r="3.2" fill={[2, 9].includes(i) ? '#ff5a3d' : '#3a4150'} className={i === 9 ? 'av-blink art-anim' : ''} />)}
    </svg>
  );
}

// --- Design: a blueprint three-view of the 012 that draws itself, holds, and draws again.
function Design() {
  // Each stroke's real length, for the dash that draws it on (CSS can't scale a dash to pathLength reliably).
  const ref = useRef(null);
  useEffect(() => { ref.current.querySelectorAll('.bp-draw').forEach((p) => p.style.setProperty('--len', Math.ceil(p.getTotalLength()))); }, []);
  const line = { fill: 'none', stroke: '#e8f1ff', strokeWidth: 1, className: 'bp-draw art-anim' };
  const dim = { ...line, stroke: '#8fb6ff', strokeWidth: 0.6 };
  return (
    <svg ref={ref} viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
      <defs>
        <pattern id="bp-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#3a6fc4" strokeWidth="0.4" /></pattern>
      </defs>
      <rect width="320" height="200" fill="#163f8f" /><rect width="320" height="200" fill="url(#bp-grid)" />
      {/* Side view. */}
      <g transform="translate(18 18)">
        <path {...line} d="M108 30L20 31V35L58 42H108Z M100 30V42 M20 31L12 12H6L4 31 M48 14H80 M54 14L58 30 M74 14L72 30 M62 42L66 54 M110 30V42 M112 28V44" />
        <circle {...line} cx="66" cy="57" r="4" />
        <path {...dim} d="M4 62H112 M4 59V65 M112 59V65" />
        <text x="58" y="72" fill="#cfe0ff" fontSize="6" textAnchor="middle" fontFamily="monospace">SIDE</text>
      </g>
      {/* Top view: wing, fuselage, tail. */}
      <g transform="translate(160 10)">
        <path {...line} d="M74 6V128 M58 6V128 M58 6H74 M58 128H74 M64 2L66 4 M60 62H140 M60 70H140 M140 62V70 M8 58H60 M8 74H60 M8 58V74 M10 50H24V82H10" />
        <path {...line} d="M74 24H88V110H74" />
        <path {...dim} d="M150 6V128 M147 6H153 M147 128H153" />
        <text x="100" y="140" fill="#cfe0ff" fontSize="6" textAnchor="middle" fontFamily="monospace">TOP</text>
      </g>
      {/* Front view: parasol wing with its tips, lower wing and winglets, wheels, prop. */}
      <g transform="translate(26 110)">
        <path {...line} d="M10 18L40 24H90L120 18 M10 18V12 M120 18V12 M54 24V40 M76 24V40 M52 40H78V60H52Z M18 58H112 M18 58V48 M112 58V48 M58 60L50 74 M72 60L80 74 M65 32V70" />
        <circle {...line} cx="48" cy="76" r="4" /><circle {...line} cx="82" cy="76" r="4" />
        <text x="65" y="88" fill="#cfe0ff" fontSize="6" textAnchor="middle" fontFamily="monospace">FRONT</text>
      </g>
      <text x="300" y="192" fill="#cfe0ff" fontSize="6" textAnchor="end" fontFamily="monospace">QUATLAS 012 · GA</text>
    </svg>
  );
}

// --- Web Development: a photo that decodes out of ASCII glyph by glyph, in a wave from the centre, then
// dissolves back and decodes again. The glyphs take their colour from the photo underneath.
const GLYPHS = ' .:-=+*#%@';
const SCRAMBLE = '<>/{}[]=+*#01';
let asciiSource = null;
function loadSource() {
  if (asciiSource) return asciiSource;
  const img = new Image(); img.src = '/img/quatlas-05-480.webp';
  asciiSource = { img, cells: null, key: '' };
  return asciiSource;
}
function drawAscii(ctx, w, h, t) {
  const src = loadSource(), { img } = src;
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, w, h);
  if (!img.complete || !img.naturalWidth) return;
  const cw = 7, ch = 10, cols = Math.ceil(w / cw), rows = Math.ceil(h / ch);
  // Sample the photo (cover-fit) once per size: one colour and brightness per cell.
  const key = `${cols}x${rows}`;
  if (src.key !== key) {
    const c = document.createElement('canvas'); c.width = cols; c.height = rows;
    const x = c.getContext('2d', { willReadFrequently: true });
    const s = Math.max(cols / img.naturalWidth, rows / (img.naturalHeight * (cw / ch)));
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s * (cw / ch);
    x.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    src.cells = x.getImageData(0, 0, cols, rows).data; src.key = key;
  }
  // 9 s cycle: decode (0–3), hold the photo (3–5.5), dissolve (5.5–8), hold the glyphs (8–9).
  const p = t % 9, maxR = Math.hypot(w, h) / 2;
  const r = p < 3 ? (p / 3) * maxR : p < 5.5 ? maxR * 1.2 : p < 8 ? (1 - (p - 5.5) / 2.5) * maxR : -1;
  // The decoded photo inside the wave.
  if (r > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 7); ctx.clip();
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    ctx.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }
  // Glyphs outside it; a band of scrambling code right at the wave front.
  ctx.font = '600 9px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
  const d = src.cells, tick = Math.floor(t * 14);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * cw, y = j * ch, dist = Math.hypot(x + cw / 2 - w / 2, y + ch / 2 - h / 2);
    if (dist < r - 6) continue;
    const k = (j * cols + i) * 4, lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
    const front = r > 0 && dist < r + 14;
    const g = front ? SCRAMBLE[(i * 7 + j * 13 + tick) % SCRAMBLE.length] : GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(lum * GLYPHS.length))];
    if (g === ' ') continue;
    ctx.fillStyle = front ? '#7dffbd' : `rgb(${d[k] * 0.6 + 60},${d[k + 1] * 0.6 + 70},${d[k + 2] * 0.6 + 70})`;
    ctx.fillText(g, x, y);
  }
}
function Web() { return useCanvas(drawAscii, 30); }

// --- Social Media: the spinning globe, as a silent loop, playing only while on screen; reduced motion
// keeps its still (the poster).
function Social() {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (still()) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src="/video/social.mp4" poster="/video/social.webp" muted loop playsInline preload="metadata" aria-hidden="true" className="absolute inset-0 size-full object-cover" />;
}

// --- Alumni: the college at night, drifting slowly closer.
function Alumni() {
  return <Img name="tile-alumni" sizes="(min-width: 1024px) 30vw, 100vw" className="art-kenburns art-anim absolute inset-0 size-full object-cover rounded-none!" />;
}

const ART = { aerodynamics: Aero, avionics: Avionics, 'social-media': Social, design: Design, 'web-development': Web, alumni: Alumni };

export default function TeamArt({ slug }) {
  const Art = ART[slug];
  return Art ? <Art /> : null;
}
export const hasArt = (slug) => slug in ART;
