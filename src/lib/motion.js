// Scroll motion: GSAP + ScrollTrigger + SplitText with Lenis smooth scrolling, loaded after hydration.
// Pages opt in with data-reveal="words" | "up" | "image" | "stagger". Hidden states are only ever set
// here, in the browser, so prerendered HTML and no-JS visitors always see everything.

export const motionAllowed = (mm = globalThis.matchMedia) =>
  typeof mm === 'function' && !mm.call(globalThis, '(prefers-reduced-motion: reduce)').matches;

// The on-load entrance only plays if motion is ready almost at once and nobody has scrolled yet;
// otherwise the reader is already looking at the content and hiding it again would be a flash.
export const playsEntrance = (elapsed, scrolled) => elapsed <= 400 && !scrolled;

let loaded = null;
let lenis = null;
// Route changes jump to the top through Lenis, so smooth-scroll inertia can't carry the old offset over.
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

export function startMotion() {
  if (!motionAllowed()) return Promise.resolve(null);
  return (loaded ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText'), import('lenis')])
    .then(([{ gsap }, { ScrollTrigger }, { SplitText }, { default: Lenis }]) => {
      gsap.registerPlugin(ScrollTrigger, SplitText);
      lenis = new Lenis({ autoRaf: false, stopInertiaOnNavigate: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      if (import.meta.env?.DEV) window.__st = ScrollTrigger;
      return { gsap, ScrollTrigger, SplitText, lenis };
    }));
}

const EASE = 'expo.out';
const FROM = {
  up: () => ({ y: 24, opacity: 0, duration: 0.8 }),
  image: () => ({ clipPath: 'inset(0% 0% 100% 0%)', scale: 1.08, duration: 1 }),
};

// Sets up every [data-reveal] inside root; returns a cleanup that undoes all of it (route change).
export function revealPage(root) {
  let ctx = null, ro = null, dead = false;
  const t0 = performance.now(), y0 = scrollY;
  startMotion().then((m) => {
    if (!m || dead || !root.isConnected) return;
    const { gsap, ScrollTrigger, SplitText } = m;
    const entrance = playsEntrance(performance.now() - t0, scrollY !== y0);
    ctx = gsap.context(() => {
      let n = 0;
      for (const el of root.querySelectorAll('[data-reveal]')) {
        const kind = el.dataset.reveal;
        let targets = el, vars;
        if (kind === 'words') {
          // The line masks clip descenders at tight line-heights, so the split is undone once it has played.
          const split = SplitText.create(el, { type: 'words,lines', mask: 'lines' });
          targets = split.words;
          vars = { yPercent: 110, stagger: 0.03, duration: 0.9, onComplete: () => split.revert() };
        } else if (kind === 'stagger') {
          targets = el.children;
          vars = { y: 16, opacity: 0, stagger: 0.03, duration: 0.6 };
        } else if (FROM[kind]) vars = FROM[kind]();
        else continue;
        if (!targets.length && targets !== el) continue;
        vars = { ...vars, ease: EASE, clearProps: 'transform,opacity,clipPath' };
        // Already on screen: play now, in document order. Below the fold: when it scrolls in.
        if (el.getBoundingClientRect().top < innerHeight * 0.9) {
          if (entrance) gsap.from(targets, { ...vars, delay: 0.08 * n++ });
          else vars.onComplete?.(); // nothing to play: undo the split straight away
        }
        else gsap.from(targets, { ...vars, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      }
    }, root);
    // Lazy images change the page height after setup; keep trigger positions honest.
    let t;
    ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 150); });
    ro.observe(root);
  });
  return () => { dead = true; ro?.disconnect(); ctx?.revert(); };
}
