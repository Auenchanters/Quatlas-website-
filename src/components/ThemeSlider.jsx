import { useEffect, useRef, useState } from 'react';

const html = () => document.documentElement;
const width = () => html().clientWidth;
const current = () => (html().dataset.theme === 'dark' ? 'dark' : 'light');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const setX = (x) => html().style.setProperty('--x', `${x}px`);

function apply(theme) {
  html().dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* private mode: the choice just isn't remembered */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f2f3ef');
}

// The line between the two themes, like an image-compare slider laid over the whole page:
// dark is always left of it. In light mode it rests on the left edge, in dark mode on the right.
// While dragging, a held-open view transition shows both themes live on either side of the line.
export default function ThemeSlider() {
  const [theme, setTheme] = useState('light');
  const wipe = useRef(null); // the drag in progress
  const busy = useRef(false); // true from press until the glide has settled

  const rest = () => html().style.setProperty('--rest', current() === 'dark' ? `${width()}px` : '0px');
  useEffect(() => {
    setTheme(current());
    rest();
    addEventListener('resize', rest);
    return () => removeEventListener('resize', rest);
  }, []);

  function begin() {
    busy.current = true;
    const from = current();
    const to = from === 'dark' ? 'light' : 'dark';
    const W = width();
    const w = { from, to, W, x: from === 'dark' ? W : 0, samples: [], moved: false, vt: null };
    setX(w.x);
    if (document.startViewTransition && !reduced()) {
      html().classList.add('vt-wipe', to === 'dark' ? 'vt-to-dark' : 'vt-to-light');
      w.vt = document.startViewTransition(() => apply(to));
    }
    return (wipe.current = w);
  }

  // Glide the line to an edge, then settle on that edge's theme.
  function finish(w, commit) {
    wipe.current = null;
    const target = (commit ? w.to : w.from) === 'dark' ? w.W : 0;
    const start = w.x, dur = reduced() ? 0 : 220 + 380 * (Math.abs(target - start) / w.W);
    const t0 = performance.now();
    const step = async (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      setX(start + (target - start) * (1 - (1 - k) ** 3));
      if (k < 1) return requestAnimationFrame(step);
      if (w.vt) {
        // A hidden tab may never take the snapshot; don't wait on it for ever.
        await Promise.race([w.vt.updateCallbackDone, new Promise((r) => setTimeout(r, 800))]).catch(() => {});
        w.vt.skipTransition();
        await w.vt.updateCallbackDone.catch(() => {});
        if (!commit) apply(w.from); // same tick as the skip, so the wrong theme never paints
      } else if (commit) apply(w.to);
      html().classList.remove('vt-wipe', 'vt-to-dark', 'vt-to-light');
      html().style.removeProperty('--x');
      rest();
      setTheme(current());
      busy.current = false;
    };
    requestAnimationFrame(step);
  }

  const down = (e) => {
    if (busy.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const w = begin();
    w.startX = e.clientX;
  };
  const move = (e) => {
    const w = wipe.current;
    if (!w) return;
    w.x = Math.max(0, Math.min(w.W, e.clientX));
    if (Math.abs(e.clientX - w.startX) > 4) w.moved = true;
    w.samples = [...w.samples.filter(([t]) => e.timeStamp - t < 100), [e.timeStamp, w.x]];
    setX(w.x);
  };
  const up = (e) => {
    const w = wipe.current;
    if (!w) return;
    if (!w.moved) return finish(w, true); // a tap switches all the way
    w.samples = w.samples.filter(([t]) => e.timeStamp - t < 100); // holding still before letting go means no flick
    const [t1, x1] = w.samples[0] ?? [0, w.x];
    const [t2, x2] = w.samples.at(-1) ?? [t1, x1];
    const v = t2 > t1 ? (x2 - x1) / (t2 - t1) : 0; // px per ms over the last 100 ms
    const projected = w.x + v * 250; // a flick carries the line on
    finish(w, w.to === 'dark' ? projected > w.W / 2 : projected < w.W / 2);
  };
  const key = (e) => {
    if (!['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key) || busy.current) return;
    e.preventDefault();
    finish(begin(), true);
  };

  const dark = theme === 'dark';
  return (
    <div className="theme-knob fixed left-0 top-0 z-[60] h-dvh w-11 pointer-events-none" style={{ viewTransitionName: 'theme-knob' }}>
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-signal" />
      <button type="button" role="switch" aria-checked={dark}
        aria-label="Dark mode. Drag the line across the page, or press to switch."
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => wipe.current && finish(wipe.current, false)} onKeyDown={key}
        className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 size-11 rounded-full border border-signal bg-paper text-signal touch-none cursor-ew-resize grid grid-cols-2 place-items-center shadow-[0_4px_14px_-6px_rgb(0_0_0/0.45)] focus-visible:outline-offset-2">
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" className="justify-self-end mr-1"><path d="M7 1 2 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" className="justify-self-start ml-1"><path d="m3 1 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
