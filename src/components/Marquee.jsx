import { useEffect, useRef, useState } from 'react';

// A strip of tiles gliding sideways forever (CSS keyframes). Enough copies are made to fill twice the
// viewport, so a handful of logos never leaves a gap; every copy after the first is hidden from
// screen readers and the keyboard. Pauses on hover and focus; a still, wrapping grid with reduced motion.
export default function Marquee({ children, label, reverse = false, speed = 40 }) {
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
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(first);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="marquee" role="region" aria-label={label}>
      <div ref={ref} className="marquee-track" data-reverse={reverse || undefined}
        style={set ? { '--set-w': `${set}px`, '--marquee-dur': `${set / speed}s` } : undefined}>
        {Array.from({ length: copies }, (_, i) => (
          <div key={i} className="marquee-set" aria-hidden={i > 0 || undefined} inert={i > 0 || undefined}>{children}</div>
        ))}
      </div>
    </div>
  );
}
