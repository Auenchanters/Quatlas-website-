import { useEffect, useRef, useState } from 'react';

// A strip of tiles gliding sideways forever (CSS keyframes). Enough copies are made to fill twice the
// viewport, so a handful of logos never leaves a gap. Copies stay clickable but are hidden from screen
// readers and skipped by Tab; `decorative` does that to the whole strip (a row that repeats another).
// Pauses on hover and focus; a still, wrapping grid with reduced motion.
const FOCUSABLE = 'a[href], button, [tabindex]';

export default function Marquee({ children, label, reverse = false, speed = 40, decorative = false }) {
  const ref = useRef(null);
  const [copies, setCopies] = useState(2);
  const [set, setSet] = useState(0);
  useEffect(() => {
    const first = ref.current?.firstElementChild;
    if (!first) return;
    const fit = () => {
      const w = first.getBoundingClientRect().width;
      if (!w) return;
      setSet(w);
      setCopies(Math.max(2, Math.ceil((2 * innerWidth) / w)));
    };
    // The observer reports the first size by itself, after the browser's own layout (measuring here, while
    // the page hydrates, would force an extra layout of the whole page).
    const ro = new ResizeObserver(fit);
    ro.observe(first);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    for (const set of ref.current?.querySelectorAll('[aria-hidden="true"]') ?? []) {
      for (const el of set.querySelectorAll(FOCUSABLE)) el.tabIndex = -1;
    }
  });
  return (
    <div className="marquee" role={decorative ? undefined : 'region'} aria-label={decorative ? undefined : label} data-decorative={decorative || undefined}>
      <div ref={ref} className="marquee-track" data-reverse={reverse || undefined}
        style={set ? { '--set-w': `${set}px`, '--marquee-dur': `${set / speed}s` } : undefined}>
        {Array.from({ length: copies }, (_, i) => (
          <div key={i} className="marquee-set" aria-hidden={decorative || i > 0 || undefined}>{children}</div>
        ))}
      </div>
    </div>
  );
}
