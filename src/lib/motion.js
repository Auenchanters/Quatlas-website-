// Scroll motion with the browser's own Web Animations (no animation library on the page), and Lenis smooth
// scrolling for mouse and trackpad only (touch scrolling is already smooth; there Lenis would only cost).
// Pages opt in with data-reveal="words" | "up" | "image" | "stagger". Hidden states are only ever set
// here, in the browser, so prerendered HTML and no-JS visitors always see everything.

export const motionAllowed = (mm = globalThis.matchMedia) =>
  typeof mm === 'function' && !mm.call(globalThis, '(prefers-reduced-motion: reduce)').matches;

// The entrance (on-screen blocks animating in) plays on a move within the site, where the new page hasn't
// been painted yet. On the first load the prerendered page is already on screen: hiding it to animate it
// in again would be a flash.
export const playsEntrance = (firstPage, scrolled) => !firstPage && !scrolled;

let lenis = null, lenisWanted = false, firstPage = true;
// Route changes jump to the top through Lenis, so smooth-scroll inertia can't carry the old offset over.
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

// Smooth wheel scrolling, started once the page is idle (Lenis measures the whole page when it starts).
function startLenis() {
  if (lenisWanted || !motionAllowed() || !matchMedia('(pointer: fine)').matches) return;
  lenisWanted = true;
  const go = () => import('lenis').then(({ default: Lenis }) => { lenis = new Lenis({ autoRaf: true, stopInertiaOnNavigate: true }); });
  (window.requestIdleCallback ?? setTimeout)(go, { timeout: 3000 });
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'; // expo out
const FROM = {
  up: { keyframes: [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], duration: 800 },
  image: { keyframes: [{ clipPath: 'inset(0% 0% 100% 0%)', transform: 'scale(1.05)' }, { clipPath: 'inset(0% 0% 0% 0%)', transform: 'none' }], duration: 700 },
  stagger: { keyframes: [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], duration: 600, step: 30 },
  words: { keyframes: [{ transform: 'translateY(110%)' }, { transform: 'none' }], duration: 900, step: 30 },
};

// Words rise out of a mask each. Plain text only (a heading with markup inside rises as one block). The
// split is undone when the words have arrived, so the heading is plain text again for everything else.
function splitWords(el) {
  if (el.children.length || !el.textContent.trim()) return null;
  const text = el.textContent, words = [];
  el.setAttribute('aria-label', text);
  el.replaceChildren(...text.split(/(\s+)/).map((w) => {
    if (!w.trim()) return document.createTextNode(w);
    const mask = document.createElement('span'), word = document.createElement('span');
    mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.12em;margin-bottom:-0.12em';
    word.style.display = 'inline-block'; word.textContent = w; word.setAttribute('aria-hidden', 'true');
    mask.append(word); words.push(word);
    return mask;
  }));
  return { words, undo: () => { el.textContent = text; el.removeAttribute('aria-label'); } };
}

// Sets up every [data-reveal] inside root; returns a cleanup that undoes all of it (route change).
// A block out of view is only made transparent (it stays in the Tab order and find in page), and plays when
// it scrolls in. Nothing is measured while a first load hydrates (an IntersectionObserver sorts the blocks).
export function revealPage(root) {
  const first = firstPage;
  firstPage = false;
  startLenis();
  if (!motionAllowed()) return () => {};
  // On a move within the site this runs before the layout scrolls the new page to the top: measure where
  // each block will be then (on a first load, where it is now).
  const entrance = playsEntrance(first, first && scrollY > 0), shift = first ? 0 : scrollY;
  const els = [...root.querySelectorAll('[data-reveal]')].filter((el) => FROM[el.dataset.reveal]);
  const running = new Set(), undo = new Set();
  const play = (el, delay = 0) => {
    const kind = el.dataset.reveal, { keyframes, duration, step = 0 } = FROM[kind];
    el.style.opacity = '';
    const split = kind === 'words' ? splitWords(el) : null;
    const targets = split ? split.words : kind === 'stagger' ? [...el.children] : [el];
    if (split) undo.add(split.undo);
    targets.forEach((t, i) => {
      const a = t.animate(split || kind !== 'words' ? keyframes : FROM.up.keyframes, { duration, delay: delay + i * step, easing: EASE, fill: 'backwards' });
      running.add(a);
      a.finished.then(() => { running.delete(a); if (split && i === targets.length - 1) { split.undo(); undo.delete(split.undo); } }, () => {});
    });
  };
  // A block reported out of view the first time is made transparent until it scrolls in; on a first load
  // that first report is how blocks are sorted (no reading of positions while the page hydrates).
  const reported = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const fresh = !reported.has(e.target); reported.add(e.target);
      if (e.isIntersecting) { io.unobserve(e.target); if (!fresh) play(e.target); }
      else if (fresh) e.target.style.opacity = '0';
    }
  }, { rootMargin: '0px 0px -5% 0px' });
  if (first) { els.forEach((el) => io.observe(el)); }
  else {
    // A move within the site: sort by position now, before the new page is painted, so the blocks on
    // screen animate in from the start.
    const tops = els.map((el) => el.getBoundingClientRect().top + shift);
    let n = 0;
    els.forEach((el, i) => {
      if (tops[i] < innerHeight * 0.9) { if (entrance) play(el, 80 * n++); return; }
      el.style.opacity = '0'; reported.add(el);
      io.observe(el);
    });
  }
  return () => {
    io.disconnect();
    running.forEach((a) => a.cancel());
    undo.forEach((f) => f());
    els.forEach((el) => { el.style.opacity = ''; });
  };
}
