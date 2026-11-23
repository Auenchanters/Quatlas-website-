import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { SheetHead } from '../components/Layout';
import Meta from '../components/Meta';
import { HANGAR } from '../content/hangar';
import NotFound from './NotFound';

// The hidden hangar, behind the footer's "secret" link: pick a game. Each game is its own chunk.
const GAMES = {
  'payload-run': lazy(() => import('../games/payload/PayloadRun')),
  dogfight: lazy(() => import('../games/dogfight/Dogfight')),
};

// A game playing itself as its card's preview, only while the card is on screen. Its code loads after the page.
// `load` resolves to make(canvas, still), which returns the per-frame draw function.
function Preview({ load }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, alive = true, seen = true, frame;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now) => { if (!seen || !alive) return; frame(now); if (!still) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([e]) => {
      const was = seen; seen = e.isIntersecting;
      if (seen && !was && frame) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    });
    load().then((make) => {
      const el = ref.current; if (!el || !alive) return;
      frame = make(el, still); io.observe(el);
      raf = requestAnimationFrame(tick);
    });
    return () => { alive = false; io.disconnect(); cancelAnimationFrame(raf); };
  }, [load]);
  return <canvas ref={ref} aria-hidden="true" className="block w-full aspect-[16/9]" />;
}

// Payload Run on autopilot, from dusk (the prettiest light).
const payloadRun = () => Promise.all([import('../games/payload/sim'), import('../games/payload/draw')]).then(([sim, art]) => (el, still) => {
  const ctx = el.getContext('2d'); el.width = sim.W; el.height = sim.H;
  let s = sim.fresh(), fx = art.createFx();
  const t0 = performance.now();
  s.dist = 6000;
  return (now) => {
    if (!still) {
      // Aim for the middle of the next gap.
      const next = s.items.find((i) => i.kind === 'pylon' && i.x > sim.PLANE_X - 30);
      const target = next ? next.top + next.gap / 2 : sim.H / 2;
      sim.step(s, s.y > target + 4 || s.vy > 3, 1); s.battery = 1;
      art.applyEvents(fx, s.events, s);
      if (s.over || s.dist > 22000) { s = sim.fresh(); s.dist = 6000; fx = art.createFx(); }
    }
    art.draw(ctx, s, fx, now - t0, 1, 0);
  };
});

// A 2D skirmish with gunfire, missiles and flares (the 3D game is too heavy to idle on a card).
const dogfight = () => import('../games/dogfight/preview').then((m) => m.createPreview);

const PREVIEWS = { 'payload-run': payloadRun, dogfight };

function Picker() {
  return (
    <>
      <SheetHead title={HANGAR.title}><p>{HANGAR.intro}</p></SheetHead>
      <section className="wrap section pt-12">
        <ul data-reveal="stagger" className="grid gap-6 md:grid-cols-2">
          {HANGAR.games.map((g) => (
            <li key={g.slug}>
              <Link to={`/hangar/${g.slug}`} className="press group grid overflow-hidden rounded-[var(--radius-photo)] border border-ink no-underline hover:border-signal h-full">
                <span className="border-b border-ink overflow-hidden bg-[#0b0d12]"><Preview load={PREVIEWS[g.slug]} /></span>
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
      <Meta title={info.name} description={info.about} noindex />
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
