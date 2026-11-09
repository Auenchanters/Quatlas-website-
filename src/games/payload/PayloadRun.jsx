import { useEffect, useRef, useState } from 'react';
import Roll from '../../components/Roll';
import { createAudio } from '../audio';
import { FULL, enterFull, exitFull, onDropOut } from '../fullscreen';
import { fresh, step, score, W, H } from './sim';
import { createFx, applyEvents, draw } from './draw';

const KEY = 'payload-best';
const best = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };
const MENU_BTN = 'btn btn-sm pointer-events-auto border-white/60 text-white hover:bg-white hover:text-[#0b0d12]';

// Payload Run: canvas, input and the ready / paused / game-over cards. The game lives in sim.js, the look
// in draw.js. A flight plays full screen; Esc (or leaving fullscreen) pauses it, with Resume and Leave.
export default function PayloadRun() {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [state, setState] = useState('ready'); // ready | flying | paused | over
  const [result, setResult] = useState(null);
  const stateRef = useRef(state); stateRef.current = state;
  const game = useRef(fresh());
  const fx = useRef(createFx());
  const hold = useRef(false);
  const audio = useRef(null);
  const motor = useRef(null);

  useEffect(() => () => { motor.current?.stop(); audio.current?.close(); exitFull(); }, []);
  const pause = () => { if (stateRef.current !== 'flying') return; hold.current = false; motor.current?.set(0, false); setState('paused'); };
  // A hidden tab, Esc in fullscreen, or leaving fullscreen: pause.
  useEffect(() => {
    const hide = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', hide);
    const stop = onDropOut(pause);
    return () => { document.removeEventListener('visibilitychange', hide); stop(); };
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
      draw(ctx, s, fx.current, now, Math.min(2.2, Math.max(1, (W / el.clientWidth) * 0.7)), best(), state === 'paused');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const start = () => {
    if (!audio.current) { audio.current = createAudio(); motor.current = audio.current.engine({ base: 95 }); }
    audio.current.resume();
    enterFull(wrap.current);
    game.current = fresh(); fx.current = createFx(); hold.current = false;
    setResult(null); setState('flying');
  };
  const resume = () => { enterFull(wrap.current); audio.current?.resume(); hold.current = false; setState('flying'); };
  const leave = () => { exitFull(); hold.current = false; motor.current?.set(0, false); game.current = fresh(); fx.current = createFx(); setResult(null); setState('ready'); };
  const canStart = () => state === 'ready' || (state === 'over' && result);

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape' && state === 'flying') return pause(); // outside fullscreen Esc does reach the page
      if (e.code !== 'Space' || state === 'paused') return;
      e.preventDefault(); if (canStart() && !e.repeat) start(); hold.current = true;
    };
    const up = (e) => { if (e.code === 'Space') hold.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  });

  const press = (e) => { e.preventDefault(); if (state === 'paused') return; if (canStart()) start(); hold.current = true; };
  const release = () => { hold.current = false; };
  const full = state !== 'ready';

  return (
    <div ref={wrap} data-lenis-prevent className={`${full ? `${FULL} bg-[#05070c]` : 'relative border border-ink'} select-none touch-none overflow-hidden`}>
      <canvas ref={canvas} className={`block cursor-pointer ${full ? 'size-full object-contain' : 'w-full h-auto aspect-[16/9]'}`}
        onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        aria-label="Payload Run game. Press and hold, or hold Space, to climb." role="img" />
      {state === 'flying' && (
        <button type="button" className={`${MENU_BTN} absolute right-3 top-3`} onClick={pause}>Pause</button>
      )}
      {/* A wide game on a phone held upright plays in a strip: say how to get it bigger, in the empty band below. */}
      {full && <p className="hidden pointer-coarse:portrait:block pointer-events-none absolute inset-x-0 bottom-[12vh] text-center data text-white/60">Turn your phone sideways for a bigger view</p>}
      {state !== 'flying' && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 text-center bg-[#0b0d12]/55 text-[#f2f3ef] p-6 pointer-events-none backdrop-blur-[2px]">
          {state === 'paused' ? (
            <>
              <p className="display text-[clamp(2rem,4vw,3.5rem)]">Paused</p>
              <button type="button" className="btn btn-signal pointer-events-auto" onClick={resume}>Resume</button>
            </>
          ) : result ? (
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
          {state !== 'paused' && <p className="wide text-sm">Press and hold to {result ? 'fly again' : 'start'}{state === 'ready' ? ': plays full screen, Esc for the menu' : ''}</p>}
          {full && <button type="button" className={MENU_BTN} onClick={leave}>Leave the game</button>}
        </div>
      )}
    </div>
  );
}
