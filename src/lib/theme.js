import { motionAllowed } from './motion';

const html = () => document.documentElement;

export function applyTheme(theme) {
  html().dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* private mode: the choice just isn't remembered */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f2f3ef');
}

export const currentTheme = () => (html().dataset.theme === 'light' ? 'light' : 'dark');

// Flips the theme. With an origin, the new theme spreads out as a circle from that point.
export function flipTheme(origin) {
  const to = currentTheme() === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || !motionAllowed()) { applyTheme(to); return to; }
  html().classList.add('theme-flip');
  const t = document.startViewTransition(() => applyTheme(to));
  t.ready.then(() => {
    if (!origin) return;
    const { x, y } = origin;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    html().animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
  t.finished.finally(() => html().classList.remove('theme-flip'));
  return to;
}
