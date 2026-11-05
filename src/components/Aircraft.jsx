import { useEffect, useRef, useState } from 'react';
import { PARTS } from '../content/aircraft';

// Isometric general-arrangement drawing of a high-wing SAE Regular-class aircraft.
// Units are arbitrary model units; x runs nose-ward, y to port, z up.
// The viewer looks down from (+x, +y, +z), so +x, +y and top faces are the visible ones.
const COS = Math.cos(Math.PI / 6);
const U = 15; // px per unit
const P = (x, y, z) => [(x - y) * COS * U, ((x + y) / 2 - z) * U];
const pts = (list) => list.map((p) => P(...p).map((n) => n.toFixed(1)).join(',')).join(' ');

// Counter-clockwise in its own (a, b) plane, so outward normals are (db, -da).
const ccw = (poly) => {
  const area = poly.reduce((s, [a, b], i) => { const [c, d] = poly[(i + 1) % poly.length]; return s + a * d - c * b; }, 0);
  return area < 0 ? [...poly].reverse() : poly;
};

// Side profile in the x–z plane, extruded across y0..y1. Visible: the +y face and any edge facing the viewer.
function prismXZ(profile, y0, y1) {
  const p = ccw(profile);
  const faces = [];
  p.forEach(([x, z], i) => {
    const [x2, z2] = p[(i + 1) % p.length];
    const nx = z2 - z, nz = -(x2 - x);
    if (nx + nz > 1e-6) faces.push({ shade: nz > Math.abs(nx) ? 'top' : 'right', pts: [[x, y0, z], [x2, y0, z2], [x2, y1, z2], [x, y1, z]] });
  });
  faces.push({ shade: 'left', pts: p.map(([x, z]) => [x, y1, z]) });
  return faces;
}

// Planform in the x–y plane, extruded z0..z1. Visible: the top and any edge facing the viewer.
function prismXY(planform, z0, z1) {
  const p = ccw(planform);
  const faces = [];
  p.forEach(([x, y], i) => {
    const [x2, y2] = p[(i + 1) % p.length];
    const nx = y2 - y, ny = -(x2 - x);
    if (nx + ny > 1e-6) faces.push({ shade: nx >= ny ? 'right' : 'left', pts: [[x, y, z0], [x2, y2, z0], [x2, y2, z1], [x, y, z1]] });
  });
  faces.push({ shade: 'top', pts: p.map(([x, y]) => [x, y, z1]) });
  return faces;
}

const box = (x0, y0, z0, x1, y1, z1) => prismXZ([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1);
const wheel = (cx, y, cz, r) => [{ shade: 'left', pts: Array.from({ length: 20 }, (_, i) => [cx + r * Math.cos((i / 20) * 2 * Math.PI), y, cz + r * Math.sin((i / 20) * 2 * Math.PI)]) }];
const strut = (a, b) => [{ shade: 'line', pts: [a, b] }];


// Painter's order, back to front. Anything entirely above another part's top plane is drawn after it.
const PIECES = [
  ['gear', strut([1, -0.7, 0.1], [1.2, -2.1, -1.5]), wheel(1.2, -2.15, -1.6, 0.55)],
  ['gear', strut([4.5, 0, 0.1], [4.7, 0, -1.15]), wheel(4.7, 0.05, -1.25, 0.45)],
  ['gear', strut([1, 0.7, 0.1], [1.2, 2.1, -1.5]), wheel(1.2, 2.15, -1.6, 0.55)],
  ['fuselage', prismXZ([[-11.8, 1.15], [-5.2, 0.9], [-5.2, 2], [-11.8, 1.75]], -0.32, 0.32)],
  ['tail', prismXY([[-9.3, -3.1], [-9.3, 3.1], [-11.7, 3.6], [-11.7, -3.6]], 1.75, 1.87)],
  ['tail', prismXZ([[-11.7, 1.87], [-9.6, 1.87], [-10.9, 4.4], [-11.7, 4.4]], -0.09, 0.09)],
  ['fuselage', prismXZ([[-5.2, 0.9], [4, 0], [4, 2], [-5.2, 2]], -1, 1)],
  ['payload', box(-1.5, -0.6, 0.4, 1, 0.6, 1.7)],
  ['motor', prismXZ([[4, 0.15], [5.2, 0.5], [5.2, 1.55], [4, 1.85]], -0.75, 0.75)],
  ['motor', prismXZ([[5.2, 0.7], [5.8, 1.03], [5.2, 1.36]], -0.32, 0.32)],
  ['motor', 'prop'],
  ['wing', prismXY([[1, -9], [1.4, -1], [1.4, 1], [1, 9], [-1.4, 9], [-2, 1], [-2, -1], [-1.4, -9]], 2, 2.28)],
];

const PROP_C = [5.85, 0, 1.03];
function propBlades(theta) {
  const [x, , cz] = PROP_C;
  const blade = (t) => {
    const r = 2.4, w = 0.22, c = Math.cos(t), s = Math.sin(t);
    return [[x, w * -s, cz + w * c], [x, r * c - 0.08 * s, cz + r * s + 0.08 * c], [x, r * c + 0.08 * s, cz + r * s - 0.08 * c], [x, w * s, cz - w * c]];
  };
  return [{ shade: 'right', pts: blade(theta) }, { shade: 'right', pts: blade(theta + Math.PI) }];
}

const FILL = { top: 'var(--fig-top)', left: 'var(--fig-left)', right: 'var(--fig-right)' };
const FILL_ON = { top: 'var(--fig-on-top)', left: 'var(--fig-on-left)', right: 'var(--fig-on-right)' };

function Face({ f, on }) {
  if (f.shade === 'line') return <polyline points={pts(f.pts)} fill="none" stroke={on ? 'var(--color-signal)' : 'var(--color-ink)'} strokeWidth="2.2" strokeLinecap="round" />;
  return <polygon points={pts(f.pts)} fill={(on ? FILL_ON : FILL)[f.shade]} stroke="var(--color-ink)" strokeWidth="0.9" strokeLinejoin="round" />;
}

export default function Aircraft() {
  const [active, setActive] = useState('wing');
  const [exploded, setExploded] = useState(true); // starts apart; assembles once on mount
  const [theta, setTheta] = useState(0.5);
  const spin = useRef(0);
  const ref = useRef(null);

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setExploded(false); return; }
    // Assemble once the page has settled and the drawing is on screen, so the move is seen and costs nothing at load.
    let t;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const go = () => { t = setTimeout(() => setExploded(false), 300); };
      document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  // The propeller turns only while the motor is the selected part.
  useEffect(() => {
    if (active !== 'motor' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = performance.now();
    const tick = (now) => { setTheta((t) => t + (now - last) * 0.012); last = now; spin.current = requestAnimationFrame(tick); };
    spin.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(spin.current);
  }, [active]);

  const part = PARTS[active];
  return (
    <figure ref={ref} className="border border-ink bg-sheet">
      <div className="relative">
        {/* Drafting grid: this panel is a drawing, so it gets the paper's grid. */}
        <svg viewBox="-262 -200 430 305" className="block w-full h-auto" role="img"
          aria-label="Isometric drawing of a Quatlas aircraft with wing, fuselage, payload bay, motor and propeller, tail and landing gear.">
          <defs>
            <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
              <path d="M15 0H0V15" fill="none" stroke="var(--fig-grid)" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect x="-262" y="-200" width="430" height="305" fill="url(#grid)" />
          {PIECES.map(([id, ...geo], i) => {
            const d = exploded ? P(...PARTS[id].explode) : [0, 0];
            const faces = geo[0] === 'prop' ? propBlades(theta) : geo.flat();
            const hidden = id === 'payload' && !exploded && active !== 'payload';
            return (
              <g key={i} onPointerEnter={() => setActive(id)} onClick={() => setActive(id)}
                style={{ transform: `translate(${d[0]}px, ${d[1]}px)`, transition: 'transform 900ms var(--ease-out-expo), opacity 400ms', opacity: hidden ? 0 : 1, cursor: 'pointer' }}>
                {faces.map((f, j) => <Face key={j} f={f} on={id === active} />)}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="data px-3 py-2 border-t border-rule text-ink-2">Fig. 1 — General arrangement, {exploded ? 'exploded' : 'assembled'}</p>

      <figcaption className="grid md:grid-cols-[1fr_1.15fr] border-t border-ink">
        <ul className="grid grid-cols-2 border-b md:border-b-0 md:border-r border-rule" aria-label="Parts">
          {Object.entries(PARTS).map(([id, p]) => (
            <li key={id} className="border-b border-rule odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
              <button type="button" aria-pressed={id === active} onClick={() => setActive(id)} onFocus={() => setActive(id)}
                className={`w-full text-left px-4 py-3 text-[0.9375rem] font-[650] whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${id === active ? 'text-signal' : 'hover:text-signal'}`}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="p-5 grid gap-2 content-start" aria-live="polite">
          <p className="data text-signal">{part.quality}</p>
          <p className="wide text-xl">{part.name}</p>
          <p className="text-ink-2">{part.text}</p>
          <button type="button" className="btn btn-sm justify-self-start mt-2" onClick={() => setExploded(!exploded)}>
            {exploded ? 'Assemble' : 'Explode the drawing'}
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
