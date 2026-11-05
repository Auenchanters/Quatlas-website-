import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { SheetHead } from '../components/Layout';
import { HANGAR } from '../content/hangar';
import NotFound from './NotFound';

// The hidden hangar, behind the footer's "secret" link: pick a game. Each game is its own chunk.
const GAMES = {
  'payload-run': lazy(() => import('../games/payload/PayloadRun')),
  dogfight: lazy(() => import('../games/dogfight/Dogfight')),
};

// Payload Run flying itself, as the card's preview (loaded with the game's chunk, after the page).
function PayloadPreview() {
  const ref = useRef(null);
  useEffect(() => {
    let raf, alive = true, seen = true;
    // Only fly while the card is on screen.
    const io = new IntersectionObserver(([e]) => { const was = seen; seen = e.isIntersecting; if (seen && !was && alive) raf = requestAnimationFrame(loop.current); });
    const loop = { current: null };
    Promise.all([import('../games/payload/sim'), import('../games/payload/draw')]).then(([sim, art]) => {
      const el = ref.current; if (!el || !alive) return;
      const ctx = el.getContext('2d'); el.width = sim.W; el.height = sim.H;
      let s = sim.fresh(), fx = art.createFx(), t0 = performance.now();
      s.dist = 6000; // start at dusk: the prettiest light
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const frame = (now) => {
        if (!seen) return;
        if (!still) {
          // Autopilot: aim for the middle of the next gap.
          const next = s.items.find((i) => i.kind === 'pylon' && i.x > sim.PLANE_X - 30);
          const target = next ? next.top + next.gap / 2 : sim.H / 2;
          sim.step(s, s.y > target + 4 || s.vy > 3, 1); s.battery = 1;
          art.applyEvents(fx, s.events, s);
          if (s.over || s.dist > 22000) { s = sim.fresh(); s.dist = 6000; fx = art.createFx(); }
        }
        art.draw(ctx, s, fx, now - t0, 1, 0);
        if (!still && alive) raf = requestAnimationFrame(frame);
      };
      loop.current = frame; io.observe(el);
      raf = requestAnimationFrame(frame);
    });
    return () => { alive = false; io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="block w-full aspect-[16/9]" />;
}

function DogfightPreview() {
  return (
    <svg viewBox="0 0 320 180" aria-hidden="true" className="block w-full aspect-[16/9]">
      <defs>
        <linearGradient id="df-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2a4a" /><stop offset="0.7" stopColor="#ff8a5c" /><stop offset="1" stopColor="#ffc58a" /></linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#df-sky)" />
      <path d="M0 150 L40 128 L80 140 L130 112 L170 136 L220 120 L270 138 L320 122 L320 180 L0 180Z" fill="#1d2a3d" />
      <path d="M0 165 L320 165 L320 180 L0 180Z" fill="#14324a" />
      {[[210, 50, 0.6], [250, 78, 0.45], [178, 92, 0.4]].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s}) rotate(-12)`} fill="#2a3442"><path d="M0 0 L60 -6 L66 0 L60 6Z M20 0 L34 -26 L42 -26 L38 0Z M20 0 L34 26 L42 26 L38 0Z M2 0 L-4 -12 L6 -12 L12 0Z" /></g>
      ))}
      <g transform="translate(70 104) rotate(-14)"><path d="M0 0 L84 -7 L92 0 L84 7Z M28 0 L48 -36 L58 -36 L52 0Z M28 0 L48 36 L58 36 L52 0Z M2 0 L-6 -16 L8 -16 L16 0Z" fill="#c41e2c" /><path d="M58 -3 L76 -4 L76 4 L58 3Z" fill="#8fd3ff" /></g>
      <path d="M150 88 L208 54" stroke="#ffe27a" strokeWidth="1.5" strokeDasharray="6 5" />
      <circle cx="160" cy="90" r="9" fill="none" stroke="#ffffff" strokeOpacity="0.8" /><path d="M160 76v6M160 98v6M146 90h6M168 90h6" stroke="#fff" strokeOpacity="0.8" />
    </svg>
  );
}

function Picker() {
  const previews = { 'payload-run': <PayloadPreview />, dogfight: <DogfightPreview /> };
  return (
    <>
      <SheetHead title={HANGAR.title}><p>{HANGAR.intro}</p></SheetHead>
      <section className="wrap section pt-12">
        <ul data-reveal="stagger" className="grid gap-6 md:grid-cols-2">
          {HANGAR.games.map((g) => (
            <li key={g.slug}>
              <Link to={`/hangar/${g.slug}`} className="press group grid border border-ink no-underline hover:border-signal h-full">
                <span className="border-b border-ink overflow-hidden bg-[#0b0d12]">{previews[g.slug]}</span>
                <span className="grid gap-2 p-5">
                  <span className="data text-signal">{g.label}</span>
                  <span className="display text-[clamp(1.75rem,3vw,2.5rem)] group-hover:text-signal transition-colors">{g.name}</span>
                  <span className="text-ink-2">{g.about}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function Hangar() {
  const { game } = useParams();
  if (!game) return <Picker />;
  const Game = GAMES[game], info = HANGAR.games.find((g) => g.slug === game);
  if (!Game) return <NotFound />;
  return (
    <>
      <SheetHead title={info.name}><p>{info.how}</p></SheetHead>
      <section className="wrap pt-10 pb-16 grid gap-4">
        <Suspense fallback={<div className="aspect-[16/9] border border-ink grid place-items-center data text-ink-2">Fuelling up…</div>}>
          <Game />
        </Suspense>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="data text-ink-2">{info.note}</p>
          <Link to="/hangar" className="btn btn-sm">Back to the hangar</Link>
        </div>
      </section>
    </>
  );
}
