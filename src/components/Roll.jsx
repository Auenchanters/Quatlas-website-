import { useEffect, useRef } from 'react';
import { splitStat } from '../lib/roll';
import { motionAllowed } from '../lib/motion';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// An odometer number: each digit rolls up into place the first time it's seen.
// Server HTML (and reduced motion) shows the final value; screen readers get the plain text.
export default function Roll({ value, suffix = '', className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    const cols = [...el.querySelectorAll('[data-d]')];
    for (const c of cols) { c.style.transition = 'none'; c.style.transform = 'translateY(0)'; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      cols.forEach((c, i) => {
        c.style.transition = `transform 900ms var(--ease-out-expo) ${i * 30}ms`;
        c.style.transform = `translateY(-${c.dataset.d}em)`;
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span className={className}>
      <span className="sr-only">{`${value}${suffix}`}</span>
      <span ref={ref} aria-hidden="true" className="roll">
        {splitStat(value).map((p, i) => 'digit' in p
          ? <span key={i} className="roll-col"><span data-d={p.digit} style={{ transform: `translateY(-${p.digit}em)` }}>{DIGITS.map((d) => <span key={d}>{d}</span>)}</span></span>
          : <span key={i}>{p.text}</span>)}
        {suffix && <span className="whitespace-pre">{suffix}</span>}
      </span>
    </span>
  );
}
