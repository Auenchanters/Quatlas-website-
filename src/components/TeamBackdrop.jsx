import { useEffect, useRef } from 'react';
import { Img } from './Img';
import { panelBox, PANEL_W, PANEL_H } from './avionics-panel';

// The full-page background behind each subteam page, under a tint of the page colour so the text stays
// readable. The scenes themselves (backdrop-scenes.js) draw in a worker on an OffscreenCanvas where the
// browser can, so they never hold up the page; this is the page side: the canvas, the pointer, presses.
// The pointer is read from the window (the page content sits on top), so the backgrounds answer it
// anywhere. Drawing stops while the tab is hidden; with reduced motion each draws once (the avionics panel
// still redraws when a control is used).

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLUGS = ['aerodynamics', 'avionics', 'design', 'social-media', 'web-development'];
const CODE = '{}<>/=;:()[]+*01#$&_.'; // Web Development's glyphs, for the text decode below

// Presses and hover reach the background anywhere except on the page's own controls (links, buttons, fields).
const bare = (el) => !el.closest?.('a, button, input, select, textarea, label, dialog, .pullcord');

function Scene({ slug }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    let worker = null, runner = null, idle = 0, dead = false, grabbed = false;
    const queue = [];
    const receive = (m) => {
      if (m.type === 'shown') c.style.opacity = '1';
      else if (m.type === 'cursor') document.documentElement.style.cursor = m.value;
    };
    const send = (m) => (worker ? worker.postMessage(m) : runner ? runner.handle(m) : queue.push(m));
    // The page first: the scene starts when the browser is idle, and fades in on its first frame.
    const start = () => {
      const init = { type: 'init', slug, w: innerWidth, h: innerHeight, still: still() };
      if ('transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof Worker === 'function') {
        worker = new Worker(new URL('./backdrop.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => receive(data);
        const off = c.transferControlToOffscreen();
        worker.postMessage({ ...init, canvas: off }, [off]);
        queue.splice(0).forEach(send);
      } else {
        import('./backdrop-scenes.js').then(({ createRunner }) => {
          if (dead) return;
          runner = createRunner(c, init, receive);
          queue.splice(0).forEach(send);
        });
      }
    };
    idle = (window.requestIdleCallback ?? setTimeout)(start, { timeout: 1200 });

    const size = () => send({ type: 'resize', w: innerWidth, h: innerHeight });
    const move = (e) => {
      send({ type: 'move', x: e.clientX, y: e.clientY, t: performance.now() });
      if (slug === 'avionics') send({ type: 'hover', x: bare(e.target) ? e.clientX : -1e4, y: bare(e.target) ? e.clientY : -1e4 });
    };
    // A press on the cockpit panel works its controls (and mustn't start a text selection); a mouse acts on
    // press, a touch on its tap, so scrolling never flips a switch.
    const onPanel = (x, y) => { const b = panelBox(innerWidth, innerHeight); return x >= b.ox && x <= b.ox + PANEL_W * b.s && y >= b.oy && y <= b.oy + PANEL_H * b.s; };
    const press = (e) => {
      if (slug !== 'avionics' || !bare(e.target) || !onPanel(e.clientX, e.clientY)) return;
      grabbed = true; e.preventDefault();
      send({ type: 'down', x: e.clientX, y: e.clientY });
    };
    const down = (e) => { if (e.pointerType !== 'touch' && e.button === 0) press(e); };
    const tap = (e) => { if (e.pointerType === 'touch') press(e); };
    const up = () => { if (grabbed) send({ type: 'up' }); grabbed = false; };
    const noSelect = (e) => grabbed && e.preventDefault();
    const vis = () => send({ type: 'visible', on: !document.hidden });
    addEventListener('resize', size); addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerdown', down); addEventListener('click', tap); addEventListener('pointerup', up);
    document.addEventListener('selectstart', noSelect); document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true; (window.cancelIdleCallback ?? clearTimeout)(idle);
      send({ type: 'destroy' }); if (worker) setTimeout(() => worker.terminate(), 100);
      document.documentElement.style.cursor = '';
      removeEventListener('resize', size); removeEventListener('pointermove', move);
      removeEventListener('pointerdown', down); removeEventListener('click', tap); removeEventListener('pointerup', up);
      document.removeEventListener('selectstart', noSelect); document.removeEventListener('visibilitychange', vis);
    };
  }, [slug]);
  return <canvas ref={ref} style={{ opacity: 0 }} className="absolute inset-0 size-full transition-opacity duration-700" />;
}

// Pilots: the aircraft in flight over the field, as a slow photo, a little darkened so the text holds.
function Flight() {
  return <Img name="gg03" sizes="100vw" className="art-kenburns art-anim absolute inset-0 size-full object-cover brightness-[0.55]" />;
}

export default function TeamBackdrop({ slug }) {
  if (!SLUGS.includes(slug) && slug !== 'pilots') return null;
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      {slug === 'pilots' ? <Flight /> : <Scene key={slug} slug={slug} />}
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
  // Scrambled glyphs are wider or narrower than the letters they replace, so left alone the text would
  // re-wrap every frame (flicker, and the page below jumps). Before scrambling, each run's line breaks are
  // written in as newlines under white-space: pre, and its block is held at its measured size.
  const breaksOf = (r) => {
    const range = document.createRange(), out = new Set();
    let top = null;
    for (let i = 0; i < r.text.length; i++) {
      if (r.text[i] === ' ') continue;
      range.setStart(r.n, i); range.setEnd(r.n, i + 1);
      const t = range.getClientRects()[0]?.top;
      if (t === undefined) continue;
      if (top !== null && t > top + 2 && r.text[i - 1] === ' ') out.add(i - 1);
      top = t;
    }
    return out;
  };
  const scramble = (r, upto) => [...r.text].map((ch, i) => (r.breaks?.has(i) ? '\n' : i < upto || ch === ' ' ? ch : glyph())).join('');
  for (const list of runs.values()) for (const r of list) r.shown = r.text;
  // element → the values of the properties this effect sets, as they were. Only those are put back:
  // other code (the scroll reveal) changes the element's inline style meanwhile, and keeps its changes.
  const PROPS = ['white-space', 'box-sizing', 'width', 'height'];
  const held = new Map();
  const keep = (el) => { if (!held.has(el)) held.set(el, PROPS.map((k) => el.style.getPropertyValue(k))); };
  // The box to hold still: the element itself, or for an inline run (a link in a list item) its block.
  const blockOf = (el) => { let b = el; while (b.parentElement && getComputedStyle(b).display === 'inline') b = b.parentElement; return b; };
  // Measures an element (no writes) and returns the write that holds it.
  const hold = (el, list) => {
    for (const r of list) r.breaks = breaksOf(r);
    const block = blockOf(el), box = block.getBoundingClientRect();
    return () => {
      keep(el); keep(block);
      el.style.whiteSpace = 'pre';
      block.style.boxSizing = 'border-box'; block.style.width = `${box.width}px`; block.style.height = `${box.height}px`;
    };
  };
  const release = (el) => {
    if (!held.has(el)) return;
    held.get(el).forEach((v, i) => (v ? el.style.setProperty(PROPS[i], v) : el.style.removeProperty(PROPS[i])));
    held.delete(el);
  };
  const timers = new Set();
  const play = (el, list) => {
    const len = Math.max(...list.map((r) => r.text.length)), dur = Math.min(900, 250 + len * 14), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      for (const r of list) {
        if (r.n.nodeValue !== r.shown) continue; // React changed it meanwhile: leave React's text alone
        r.shown = k < 1 ? scramble(r, Math.floor(k * r.text.length)) : r.text;
        r.n.nodeValue = r.shown;
      }
      if (k < 1) { const id = requestAnimationFrame(step); timers.add(id); } else { release(el); release(blockOf(el)); }
    };
    timers.add(requestAnimationFrame(step));
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); play(e.target, runs.get(e.target)); }
  }, { rootMargin: '0px 0px -8% 0px' });
  // Text is scrambled only as it nears the screen, so the page keeps its real words (for screen readers,
  // find in page, translation) everywhere the reader hasn't reached yet.
  const near = new IntersectionObserver((entries) => {
    const coming = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    const writes = coming.map((el) => hold(el, runs.get(el))); // every measurement first, then every write
    coming.forEach((el, i) => {
      near.unobserve(el); writes[i]();
      for (const r of runs.get(el)) { r.shown = scramble(r, 0); r.n.nodeValue = r.shown; }
      io.observe(el);
    });
  }, { rootMargin: '0px 0px 25% 0px' });
  runs.forEach((_, el) => near.observe(el));
  return () => {
    near.disconnect(); io.disconnect(); timers.forEach(cancelAnimationFrame);
    for (const list of runs.values()) for (const r of list) if (r.n.nodeValue === r.shown) r.n.nodeValue = r.text;
    [...held.keys()].forEach(release);
  };
}
