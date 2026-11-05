// Scroll motion: GSAP + ScrollTrigger + SplitText with Lenis smooth scrolling, loaded after hydration.
// Pages opt in with data-reveal="words" | "up" | "image" | "stagger". Hidden states are only ever set
// here, in the browser, so prerendered HTML and no-JS visitors always see everything.

export const motionAllowed = (mm = globalThis.matchMedia) =>
  typeof mm === 'function' && !mm.call(globalThis, '(prefers-reduced-motion: reduce)').matches;

let loaded = null;
export function startMotion() {
  if (!motionAllowed()) return Promise.resolve(null);
  return (loaded ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText'), import('lenis')])
    .then(([{ gsap }, { ScrollTrigger }, { SplitText }, { default: Lenis }]) => {
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const lenis = new Lenis({ autoRaf: false });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      if (import.meta.env?.DEV) window.__st = ScrollTrigger;
      return { gsap, ScrollTrigger, SplitText, lenis };
    }));
}

const EASE = 'expo.out';
const FROM = {
  up: () => ({ y: 24, autoAlpha: 0, duration: 0.8 }),
  image: () => ({ clipPath: 'inset(0% 0% 100% 0%)', scale: 1.08, duration: 1 }),
};

// Sets up every [data-reveal] inside root; returns a cleanup that undoes all of it (route change).
export function revealPage(root) {
  let ctx = null, ro = null, dead = false;
  startMotion().then((m) => {
    if (!m || dead || !root.isConnected) return;
    const { gsap, ScrollTrigger, SplitText } = m;
    ctx = gsap.context(() => {
      let n = 0;
      for (const el of root.querySelectorAll('[data-reveal]')) {
        const kind = el.dataset.reveal;
        let targets = el, vars;
        if (kind === 'words') {
          targets = SplitText.create(el, { type: 'words,lines', mask: 'lines' }).words;
          vars = { yPercent: 110, stagger: 0.03, duration: 0.9 };
        } else if (kind === 'stagger') {
          targets = el.children;
          vars = { y: 16, autoAlpha: 0, stagger: 0.03, duration: 0.6 };
        } else if (FROM[kind]) vars = FROM[kind]();
        else continue;
        if (!targets.length && targets !== el) continue;
        vars = { ...vars, ease: EASE, clearProps: 'transform,opacity,visibility,clipPath' };
        // Already on screen: play now, in document order. Below the fold: when it scrolls in.
        if (el.getBoundingClientRect().top < innerHeight * 0.9) gsap.from(targets, { ...vars, delay: 0.08 * n++ });
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
