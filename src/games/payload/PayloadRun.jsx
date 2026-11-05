import { useEffect, useRef, useState } from 'react';
import Roll from '../../components/Roll';
import { createAudio } from '../audio';
import { fresh, step, score, W, H } from './sim';
import { createFx, applyEvents, draw } from './draw';

const KEY = 'payload-best';
const best = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };

// Payload Run: canvas, input and the ready / game-over cards. The game lives in sim.js, the look in draw.js.
export default function PayloadRun() {
  const canvas = useRef(null);
  const [state, setState] = useState('ready'); // ready | flying | over
  const [result, setResult] = useState(null);
  const game = useRef(fresh());
  const fx = useRef(createFx());
  const hold = useRef(false);
  const audio = useRef(null);
  const motor = useRef(null);

  useEffect(() => () => { motor.current?.stop(); audio.current?.close(); }, []);
  // A hidden tab stops drawing; the motor must stop humming too.
  useEffect(() => {
    const hide = () => { if (document.hidden) { hold.current = false; motor.current?.set(0, false); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);

  useEffect(() => {
    const el = canvas.current, ctx = el.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    el.width = W * dpr; el.height = H * dpr;
    let raf, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(2, (now - last) / 16.67); last = now;
      const s = game.current;
      if (state === 'flying') {
        step(s, hold.current, dt);
        applyEvents(fx.current, s.events, s);
        motor.current?.set(hold.current && s.battery > 0 ? 1 : 0.25, !s.over);
        for (const e of s.events) {
          if (e.type === 'pickup') e.kind === 'crate' ? audio.current?.pickup() : audio.current?.charge();
          if (e.type === 'crash') {
            audio.current?.crash();
            const sc = score(s);
            try { if (sc > best()) localStorage.setItem(KEY, sc); } catch { /* private mode */ }
            setResult({ why: e.why, score: sc, kg: s.kg, dist: Math.floor(s.dist / 10) });
            setTimeout(() => setState('over'), 700); // let the crash play out first
          }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // k scales the readouts up when the canvas is drawn small (phones).
      draw(ctx, s, fx.current, now, Math.min(2.2, Math.max(1, (W / el.clientWidth) * 0.7)), best());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const start = () => {
    if (!audio.current) { audio.current = createAudio(); motor.current = audio.current.engine({ base: 95 }); }
    audio.current.resume();
    game.current = fresh(); fx.current = createFx(); hold.current = false;
    setResult(null); setState('flying');
  };
  const canStart = () => state === 'ready' || (state === 'over' && result);

  useEffect(() => {
    const down = (e) => { if (e.code !== 'Space') return; e.preventDefault(); if (canStart() && !e.repeat) start(); hold.current = true; };
    const up = (e) => { if (e.code === 'Space') hold.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  });

  const press = (e) => { e.preventDefault(); if (canStart()) start(); hold.current = true; };
  const release = () => { hold.current = false; };

  return (
    <div className="relative border border-ink select-none touch-none overflow-hidden">
      <canvas ref={canvas} className="block w-full h-auto aspect-[16/9] cursor-pointer"
        onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        aria-label="Payload Run game. Press and hold, or hold Space, to climb." role="img" />
      {state !== 'flying' && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 text-center bg-[#0b0d12]/55 text-[#f2f3ef] p-6 pointer-events-none backdrop-blur-[2px]">
          {result ? (
            <>
              <p className="data text-[#ff8790]">{result.why}</p>
              <p className="display text-6xl md:text-7xl"><Roll value={result.score} /></p>
              <dl className="flex gap-6 text-[#c9ced6]">
                <div><dt className="text-sm">Flown</dt><dd className="text-white">{result.dist} m</dd></div>
                <div><dt className="text-sm">Delivered</dt><dd className="text-white">{result.kg.toFixed(1)} kg</dd></div>
                <div><dt className="text-sm">Best</dt><dd className="text-white">{best()}</dd></div>
              </dl>
            </>
          ) : <p className="display text-[clamp(2rem,4vw,3.5rem)]">Ready for takeoff</p>}
          <p className="wide text-sm">Press and hold to {result ? 'fly again' : 'start'}</p>
        </div>
      )}
    </div>
  );
}
