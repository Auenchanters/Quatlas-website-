import { useEffect, useState } from 'react';
import { Moon, Sun } from './icons';

const html = () => document.documentElement;

function apply(theme) {
  html().dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* private mode: the choice just isn't remembered */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f2f3ef');
}

// One button: dark or light. Cross-fades where the browser supports view transitions.
export default function ThemeToggle() {
  const [dark, setDark] = useState(true); // the server can't know; corrected on mount
  useEffect(() => setDark(html().dataset.theme === 'dark'), []);
  const flip = () => {
    const to = dark ? 'light' : 'dark';
    const run = () => { apply(to); setDark(!dark); };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(run);
    else run();
  };
  return (
    <button type="button" onClick={flip} aria-pressed={dark} aria-label="Dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid place-items-center size-11 hover:text-signal">
      {dark ? <Moon /> : <Sun />}
    </button>
  );
}
