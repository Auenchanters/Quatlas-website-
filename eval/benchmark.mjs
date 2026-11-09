// The bar the site must clear. Every number here is a hard gate: one miss and the benchmark is not met.
// Raise a bar freely; lower one only with a written reason next to it.

export const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const PORT = 4400;

export const ROUTES = ['/', '/about', '/team', '/team/aerodynamics', '/team/avionics', '/team/design', '/team/web-development', '/team/social-media', '/team/pilots',
  '/achievements', '/events', '/gallery', '/support', '/contact', '/alumini', '/recruitment', '/terms', '/results', '/login', '/hangar'];

export const VIEWPORTS = [
  { name: 'phone-s', width: 360, height: 740, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

export const LIGHTHOUSE = {
  // Mobile: Lighthouse's default Moto G Power on slow 4G with 4x CPU slowdown.
  mobile: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 },
  desktop: { performance: 99, accessibility: 100, 'best-practices': 100, seo: 100 },
  // Core Web Vitals and friends, mobile (ms, CLS unitless).
  metrics: { 'largest-contentful-paint': 2000, 'first-contentful-paint': 1500, 'total-blocking-time': 100, 'cumulative-layout-shift': 0.02, 'speed-index': 2500 },
};

export const PAGES = {
  cls: 0.02,          // layout shift while loading and scrolling the whole page
  tapTarget: 24,      // px, WCAG 2.2 target size (minimum)
  navMs: 400,         // client-side route change until the new page's h1 shows
  longTaskMs: 200,    // no single main-thread task longer than this while scrolling (unthrottled)
};

export const BUDGETS = {
  // Bytes over the wire (brotli), first visit to the home page on a phone, before any interaction.
  homeCriticalJs: 100_000,  // scripts named in the HTML: what blocks the first render
  homeJs: 300_000,          // every script the home page itself needs (incl. three.js, 116 kB, for the hero model)
  homePrefetch: 60_000,     // the other pages' chunks, fetched when idle after load
  homeCss: 14_000,
  homeFonts: 100_000,       // three families (display, text, mono), latin subsets only
  homeTotal: 650_000,
  // Largest single image any public page loads, at phone width and at desktop width.
  image: 140_000,
  imageDesktop: 400_000,
};

export const MOTION = {
  fps: 55,             // median frames per second for the home 3D plane and both games (desktop, GPU)
  fpsP5: 40,           // 5th percentile
};

export const API_MS = 1500;  // live API GET round trip

// name → { file?, needsBuild }
export const SUITES = {
  static: { needsBuild: true },
  model: {},
  pages: { needsBuild: true },
  visual: { needsBuild: true },
  games: { needsBuild: true },
  backend: {},
  lighthouse: { needsBuild: true },
};
